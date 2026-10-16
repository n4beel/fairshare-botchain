// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/// @title Splitter
/// @notice Receives BOT and divides it between fixed payees by share.
///
/// @dev **Payees pull; the contract never pushes.** Splitting on receipt would mean a single payee
/// that rejects payment — a contract with no payable fallback, a wallet that reverts — breaks
/// every payment into the splitter for everyone. It would also put an unbounded loop in `receive`,
/// so whether a payment succeeds would depend on how much gas the sender happened to forward.
/// Here `receive` only accepts, and each payee withdraws when they want to.
///
/// **Accounting from total receipts, not from a running pot.** `releasable` derives what a payee
/// is owed from everything the contract has ever received — current balance plus everything
/// already paid out — rather than tracking an undistributed balance. That makes a payment arriving
/// mid-withdrawal impossible to miscount, and means shares apply to money that arrives later with
/// no bookkeeping at the moment it lands.
///
/// **Configuration is permanent.** No owner, no way to change payees or shares, no withdrawal
/// hatch. Whoever deploys it cannot redirect it afterwards, which is the only thing that makes it
/// worth pointing an income stream at.
contract Splitter {
  address[] private _payees;
  mapping(address payee => uint256) public sharesOf;
  mapping(address payee => uint256) public releasedTo;

  uint256 public immutable totalShares;
  uint256 public totalReleased;

  event Received(address indexed from, uint256 amount);
  event Released(address indexed payee, uint256 amount);

  error NoPayees();
  error LengthMismatch(uint256 payees, uint256 shares);
  error TooManyPayees(uint256 count, uint256 max);
  error ZeroPayee(uint256 index);
  error ZeroShares(uint256 index);
  error DuplicatePayee(address payee);
  error NotAPayee(address account);
  error NothingDue(address payee);
  error PaymentFailed(address payee, uint256 amount);

  /// @dev Bounded because the duplicate check is quadratic and `releaseAll` loops over everyone.
  /// Fifty is far beyond what a revenue split realistically needs.
  uint256 public constant MAX_PAYEES = 50;

  constructor(address[] memory payees_, uint256[] memory shares_) {
    uint256 count = payees_.length;
    if (count == 0) revert NoPayees();
    if (count != shares_.length) revert LengthMismatch(count, shares_.length);
    if (count > MAX_PAYEES) revert TooManyPayees(count, MAX_PAYEES);

    uint256 total;
    for (uint256 i = 0; i < count; i++) {
      address payee = payees_[i];
      if (payee == address(0)) revert ZeroPayee(i);
      if (shares_[i] == 0) revert ZeroShares(i);
      // Duplicates would double a payee's claim while `releasedTo` tracked them once, so the
      // second entry's share would be permanently unclaimable and the split silently wrong.
      if (sharesOf[payee] != 0) revert DuplicatePayee(payee);

      sharesOf[payee] = shares_[i];
      _payees.push(payee);
      total += shares_[i];
    }

    totalShares = total;
  }

  /// @dev Accepts anything, counts nothing. The accounting is derived, not maintained.
  receive() external payable {
    emit Received(msg.sender, msg.value);
  }

  // --- withdrawal ------------------------------------------------------------------------------

  /// @notice Pay a payee what they are owed.
  /// @dev Callable by anyone, not just the payee. A payee with no BOT for gas cannot otherwise be
  /// paid at all, so whoever set the split up can settle on their behalf. There is no risk in
  /// this: the funds can only go to the payee.
  function release(address payee) public {
    if (sharesOf[payee] == 0) revert NotAPayee(payee);

    uint256 amount = releasable(payee);
    if (amount == 0) revert NothingDue(payee);

    // Effects before interaction. A reentrant call lands after `releasedTo` is updated, so
    // `releasable` returns zero on the way back in and the second withdrawal reverts.
    releasedTo[payee] += amount;
    totalReleased += amount;

    (bool ok,) = payee.call{value: amount}("");
    if (!ok) revert PaymentFailed(payee, amount);

    emit Released(payee, amount);
  }

  /// @notice Pay everyone at once.
  /// @dev All-or-nothing: one payee that refuses payment reverts the batch. It does not strand
  /// anyone — `release(payee)` still works individually for every other payee, which is the
  /// documented way around a rejecting address. Skipping failures silently instead would make a
  /// partial payout look like a complete one.
  function releaseAll() external {
    uint256 count = _payees.length;
    for (uint256 i = 0; i < count; i++) {
      if (releasable(_payees[i]) > 0) release(_payees[i]);
    }
  }

  // --- reads -----------------------------------------------------------------------------------

  /// @notice What a payee could withdraw right now.
  function releasable(address payee) public view returns (uint256) {
    uint256 shares = sharesOf[payee];
    if (shares == 0) return 0;

    // Everything this contract has ever been paid.
    uint256 received = address(this).balance + totalReleased;
    uint256 owed = (received * shares) / totalShares;

    // Cannot underflow in practice: `owed` only grows as `received` grows, and `releasedTo` is
    // only ever set to a previous value of `owed`.
    return owed - releasedTo[payee];
  }

  function payees() external view returns (address[] memory) {
    return _payees;
  }

  function payeeCount() external view returns (uint256) {
    return _payees.length;
  }

  /// @notice Everything this splitter has ever received.
  function totalReceived() external view returns (uint256) {
    return address(this).balance + totalReleased;
  }
}
