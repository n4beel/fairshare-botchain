// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Test} from "forge-std/Test.sol";
import {Splitter} from "../src/Splitter.sol";
import {SplitterFactory} from "../src/SplitterFactory.sol";

contract Rejector {
  receive() external payable {
    revert("nope");
  }
}

/// Calls back into the splitter the moment it is paid, trying to be paid twice from one claim.
contract Reentrant {
  Splitter private splitter;
  uint256 public entries;
  bool public doubled;

  function target(Splitter s) external {
    splitter = s;
  }

  receive() external payable {
    entries++;
    if (entries > 1) return;
    try splitter.release(address(this)) {
      doubled = true;
    } catch {}
  }
}

contract SplitterTest is Test {
  SplitterFactory internal factory;
  Splitter internal splitter;

  address internal alice = address(0xA11CE);
  address internal bob = address(0xB0B);
  address internal carol = address(0xCA201);
  address internal payer = address(0xBEEF);

  event Released(address indexed payee, uint256 amount);
  event Received(address indexed from, uint256 amount);

  function setUp() public {
    factory = new SplitterFactory();
    vm.deal(payer, 1000 ether);

    address[] memory payees = new address[](3);
    payees[0] = alice;
    payees[1] = bob;
    payees[2] = carol;
    uint256[] memory shares = new uint256[](3);
    shares[0] = 50;
    shares[1] = 30;
    shares[2] = 20;

    splitter = Splitter(payable(factory.create(payees, shares)));
  }

  function fund(uint256 amount) internal {
    vm.prank(payer);
    (bool ok,) = address(splitter).call{value: amount}("");
    assertTrue(ok, "splitter refused payment");
  }

  // --- the split --------------------------------------------------------------------------------

  function test_SplitsByShare() public {
    fund(100 ether);

    assertEq(splitter.releasable(alice), 50 ether);
    assertEq(splitter.releasable(bob), 30 ether);
    assertEq(splitter.releasable(carol), 20 ether);
  }

  function test_ReleasePays() public {
    fund(100 ether);

    splitter.release(alice);

    assertEq(alice.balance, 50 ether);
    assertEq(splitter.releasable(alice), 0, "still owed after being paid");
    assertEq(splitter.releasable(bob), 30 ether, "bob's claim changed");
  }

  /// The reason accounting derives from total receipts rather than a running pot: money arriving
  /// later must be split by the same shares with no bookkeeping at the moment it lands.
  function test_LaterPaymentsAreSplitToo() public {
    fund(100 ether);
    splitter.release(alice);

    fund(100 ether);

    assertEq(splitter.releasable(alice), 50 ether, "second payment not credited to alice");
    assertEq(splitter.releasable(bob), 60 ether, "bob should have both payments' share");
  }

  /// A payment landing between two withdrawals must not be miscounted.
  function test_PaymentArrivingBetweenWithdrawalsIsCountedOnce() public {
    fund(100 ether);
    splitter.release(alice);
    fund(50 ether);
    splitter.release(bob);
    splitter.release(carol);
    splitter.release(alice);

    assertEq(alice.balance, 75 ether, "alice");
    assertEq(bob.balance, 45 ether, "bob");
    assertEq(carol.balance, 30 ether, "carol");
    assertEq(address(splitter).balance, 0, "dust left behind");
  }

  function test_AnyoneCanReleaseForAPayee() public {
    // A payee with no BOT for gas could otherwise never be paid.
    fund(100 ether);

    vm.prank(address(0xDEAD));
    splitter.release(alice);

    assertEq(alice.balance, 50 ether);
  }

  function test_ReleaseAllPaysEveryone() public {
    fund(100 ether);

    splitter.releaseAll();

    assertEq(alice.balance, 50 ether);
    assertEq(bob.balance, 30 ether);
    assertEq(carol.balance, 20 ether);
    assertEq(address(splitter).balance, 0);
  }

  function test_Emits() public {
    fund(100 ether);

    vm.expectEmit(true, false, false, true, address(splitter));
    emit Released(alice, 50 ether);
    splitter.release(alice);
  }

  // --- reentrancy --------------------------------------------------------------------------------

  /// Effects before interaction: a reentrant call lands after `releasedTo` is updated, so
  /// `releasable` returns zero on the way back in.
  function test_ReentrantPayeeCannotBePaidTwice() public {
    Reentrant attacker = new Reentrant();

    address[] memory payees = new address[](2);
    payees[0] = address(attacker);
    payees[1] = bob;
    uint256[] memory shares = new uint256[](2);
    shares[0] = 50;
    shares[1] = 50;

    Splitter s = Splitter(payable(factory.create(payees, shares)));
    attacker.target(s);

    vm.prank(payer);
    (bool ok,) = address(s).call{value: 100 ether}("");
    assertTrue(ok);

    s.release(address(attacker));

    assertFalse(attacker.doubled(), "the reentrant claim succeeded");
    assertEq(address(attacker).balance, 50 ether, "attacker took more than its share");
    assertEq(s.releasable(bob), 50 ether, "bob's claim was raided");
  }

  // --- a payee that will not be paid ---------------------------------------------------------------

  /// One rejecting payee must not strand everyone else. The batch reverts; individual releases
  /// still work, which is the documented way around it.
  function test_RejectingPayeeBlocksOnlyTheBatch() public {
    Rejector rejector = new Rejector();

    address[] memory payees = new address[](2);
    payees[0] = address(rejector);
    payees[1] = bob;
    uint256[] memory shares = new uint256[](2);
    shares[0] = 50;
    shares[1] = 50;

    Splitter s = Splitter(payable(factory.create(payees, shares)));
    vm.prank(payer);
    (bool ok,) = address(s).call{value: 100 ether}("");
    assertTrue(ok);

    vm.expectRevert(abi.encodeWithSelector(Splitter.PaymentFailed.selector, address(rejector), 50 ether));
    s.releaseAll();

    // ...but bob is not trapped.
    s.release(bob);
    assertEq(bob.balance, 50 ether, "bob could not be paid around the rejecting payee");
  }

  // --- guards ----------------------------------------------------------------------------------

  function test_NothingDueReverts() public {
    vm.expectRevert(abi.encodeWithSelector(Splitter.NothingDue.selector, alice));
    splitter.release(alice);
  }

  function test_NonPayeeReverts() public {
    fund(100 ether);
    vm.expectRevert(abi.encodeWithSelector(Splitter.NotAPayee.selector, address(0xDEAD)));
    splitter.release(address(0xDEAD));
  }

  function test_RejectsEmptyPayees() public {
    vm.expectRevert(Splitter.NoPayees.selector);
    factory.create(new address[](0), new uint256[](0));
  }

  function test_RejectsLengthMismatch() public {
    vm.expectRevert(abi.encodeWithSelector(Splitter.LengthMismatch.selector, 2, 1));
    factory.create(new address[](2), new uint256[](1));
  }

  function test_RejectsZeroPayeeAndZeroShares() public {
    address[] memory payees = new address[](1);
    uint256[] memory shares = new uint256[](1);
    shares[0] = 1;
    vm.expectRevert(abi.encodeWithSelector(Splitter.ZeroPayee.selector, uint256(0)));
    factory.create(payees, shares);

    payees[0] = alice;
    shares[0] = 0;
    vm.expectRevert(abi.encodeWithSelector(Splitter.ZeroShares.selector, uint256(0)));
    factory.create(payees, shares);
  }

  /// A duplicate would double a payee's claim while `releasedTo` tracked them once, making the
  /// second entry's share permanently unclaimable and the split silently wrong.
  function test_RejectsDuplicatePayee() public {
    address[] memory payees = new address[](2);
    payees[0] = alice;
    payees[1] = alice;
    uint256[] memory shares = new uint256[](2);
    shares[0] = 1;
    shares[1] = 1;

    vm.expectRevert(abi.encodeWithSelector(Splitter.DuplicatePayee.selector, alice));
    factory.create(payees, shares);
  }

  function test_RejectsTooManyPayees() public {
    address[] memory payees = new address[](51);
    uint256[] memory shares = new uint256[](51);
    for (uint256 i = 0; i < 51; i++) {
      payees[i] = address(uint160(i + 1));
      shares[i] = 1;
    }
    vm.expectRevert(abi.encodeWithSelector(Splitter.TooManyPayees.selector, uint256(51), uint256(50)));
    factory.create(payees, shares);
  }

  // --- configuration is permanent -----------------------------------------------------------------

  /// The product claim: whoever deploys a splitter cannot redirect it afterwards. That is only
  /// true if no such function exists.
  function test_ConfigurationCannotChange() public {
    assertEq(splitter.totalShares(), 100);
    assertEq(splitter.sharesOf(alice), 50);
    assertEq(splitter.payeeCount(), 3);

    address[] memory current = splitter.payees();
    assertEq(current[0], alice);
    assertEq(current[1], bob);
    assertEq(current[2], carol);
  }

  // --- rounding --------------------------------------------------------------------------------

  /// Integer division leaves at most a few wei undistributed. It is not lost — it is credited as
  /// soon as enough arrives to round past the boundary.
  function test_DustIsRetainedNotLost() public {
    // The payer's balance has to cover both funds below; the first spends 101 wei of it.
    vm.deal(payer, 2000 ether);
    fund(100 wei + 1 wei);

    splitter.releaseAll();
    uint256 remaining = address(splitter).balance;
    assertLt(remaining, 3, "more than rounding dust was left");

    fund(1000 ether);
    splitter.releaseAll();
    assertEq(alice.balance + bob.balance + carol.balance + address(splitter).balance, 1000 ether + 101 wei);
  }

  // --- properties ----------------------------------------------------------------------------------

  function testFuzz_NobodyCanWithdrawMoreThanTheirShare(uint96 amount) public {
    vm.assume(amount > 100);
    vm.deal(payer, uint256(amount) + 1 ether);
    vm.prank(payer);
    (bool ok,) = address(splitter).call{value: amount}("");
    assertTrue(ok);

    splitter.releaseAll();

    assertLe(alice.balance, (uint256(amount) * 50) / 100 + 1);
    assertLe(bob.balance, (uint256(amount) * 30) / 100 + 1);
    assertLe(carol.balance, (uint256(amount) * 20) / 100 + 1);
    assertLe(alice.balance + bob.balance + carol.balance, amount, "paid out more than came in");
  }

  function testFuzz_PayoutsNeverExceedReceipts(uint96 first, uint96 second) public {
    vm.assume(first > 100 && second > 100);
    vm.deal(payer, uint256(first) + uint256(second) + 1 ether);

    vm.startPrank(payer);
    (bool a,) = address(splitter).call{value: first}("");
    assertTrue(a);
    vm.stopPrank();
    splitter.releaseAll();

    vm.prank(payer);
    (bool b,) = address(splitter).call{value: second}("");
    assertTrue(b);
    splitter.releaseAll();

    uint256 paid = alice.balance + bob.balance + carol.balance;
    assertLe(paid, uint256(first) + uint256(second), "paid out more than came in");
    assertEq(paid + address(splitter).balance, uint256(first) + uint256(second), "value vanished");
  }
}
