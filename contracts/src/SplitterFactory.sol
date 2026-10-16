// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Splitter} from "./Splitter.sol";

/// @title SplitterFactory
/// @notice Deploys a Splitter. One transaction, and the address it returns is the one to be paid.
///
/// @dev Stores nothing. Every splitter is announced in a log indexed by creator, and the frontend
/// reads those from the factory's deploy block — which is why the deployment config carries it.
contract SplitterFactory {
  event SplitterCreated(
    address indexed splitter, address indexed creator, address[] payees, uint256[] shares
  );

  /// @notice Deploy a splitter.
  /// @dev Validation lives in the Splitter constructor rather than being repeated here. One copy
  /// of the rules means the factory and a hand-deployed splitter cannot disagree about what a
  /// valid split is.
  function create(address[] calldata payees, uint256[] calldata shares)
    external
    returns (address splitter)
  {
    splitter = address(new Splitter(payees, shares));
    emit SplitterCreated(splitter, msg.sender, payees, shares);
  }
}
