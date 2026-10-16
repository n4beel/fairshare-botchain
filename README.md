# Fairshare

Deploy an address that splits whatever it receives, by shares nobody can change.

**The one transaction:** `create(address[] payees, uint256[] shares)`

### Bohr testnet (968) — live

| | |
|---|---|
| Contract | [`0x97d836c2D41de4e3bfC9cfe15bC87a5598836D6a`](https://scan.bohr.life/address/0x97d836c2D41de4e3bfC9cfe15bC87a5598836D6a) · source verified |
| Deploy block | 27061871 |

### BOT Chain mainnet (677) — not yet deployed

Mainnet is the only network the listing bar accepts. The site currently targets Bohr, and the
network badge reads **Testnet** in amber so a screenshot from it can never be mistaken for
listing proof.

---

## Payees pull; the contract never pushes

Splitting on receipt would mean one payee that rejects payment breaks every payment into the
splitter, for everyone — and would put an unbounded loop in `receive()`, so whether a payment
succeeded would depend on how much gas the sender happened to forward.

Instead the splitter only accepts, and each payee withdraws when they want. Anyone can trigger a
release *to* a payee, which matters because a payee holding no BOT for gas could otherwise never
be paid; the money can only ever go to the payee.

Accounting derives from everything the contract has ever received, not from a running pot. A
payment arriving mid-withdrawal is therefore impossible to miscount, and money arriving later is
split by the same shares with no bookkeeping at the moment it lands.

**Configuration is permanent.** No owner, no setters, no withdrawal hatch — whoever deploys it
cannot redirect it afterwards, which is the only thing that makes it worth pointing an income
stream at.

**20 tests**, including a reentrant payee failing to be paid twice.

## Development

```bash
npm install
npm run chain:check          # both BOT Chain networks: ID, head age, gas price
npm test                     # unit tests and the render-loop lint rule
npm run test:integration     # the ABI against the real contract on anvil, where present
npm run dev

cd contracts && forge test -vv
```

## Deploying

Put `DEPLOYER_PRIVATE_KEY` in `.env` (gitignored, `0x` prefix optional), then:

```bash
cd contracts
./deploy.sh bohr --dry     # simulate, broadcast nothing
./deploy.sh bohr           # testnet
./deploy.sh botchain       # mainnet — real BOT, no faucet
```

The wrapper asks the node what chain it is on and refuses to broadcast if it disagrees with the
network named — the one mistake here that cannot be undone. It then verifies the source on the
explorer, reading the contract's name from the broadcast log rather than guessing it from a
filename.

## Built from the template

`../template`, extracted from `ST-Frontier/ghost-pay`. See `../TEMPLATE.md`.
