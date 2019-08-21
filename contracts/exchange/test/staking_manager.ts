import { blockchainTests, constants, expect, LogDecoder } from '@0x/contracts-test-utils';
import { BigNumber, OwnableRevertErrors } from '@0x/utils';
import { LogWithDecodedArgs } from 'ethereum-types';

import { artifacts, ExchangeContract, ExchangeUpdatedStakingAddressEventArgs } from '../src';

blockchainTests.resets('MixinStakingManager', env => {
    let accounts: string[];
    let exchange: ExchangeContract;
    let logDecoder: LogDecoder;
    let nonOwner: string;
    let owner: string;
    let staking: string;

    before(async () => {
        accounts = await env.web3Wrapper.getAvailableAddressesAsync();
        nonOwner = accounts[0];
        owner = accounts[1];
        staking = accounts[2];

        // Update the from address of the txDefaults. This is the address that will become the owner.
        env.txDefaults.from = accounts[1];

        // Deploy the exchange contract.
        exchange = await ExchangeContract.deployFrom0xArtifactAsync(
            artifacts.Exchange,
            env.provider,
            env.txDefaults,
            {},
            new BigNumber(1337),
        );

        // Configure the log decoder
        logDecoder = new LogDecoder(env.web3Wrapper, artifacts);
    });

    describe('updateStakingAddress', () => {
        it('should revert if msg.sender != owner', async () => {
            const expectedError = new OwnableRevertErrors.OnlyOwnerError(nonOwner, owner);

            // Ensure that the transaction reverts with the expected rich error.
            const tx = exchange.updateStakingAddress.sendTransactionAsync(staking, {
                from: nonOwner,
            });
            return expect(tx).to.revertWith(expectedError);
        });

        it('should succeed and emit an UpdatedStakingAddress event if msg.sender == owner', async () => {
            // Call the `updateStakingAddress()` function and get the receipt.
            const receipt = await logDecoder.getTxWithDecodedLogsAsync(
                await exchange.updateStakingAddress.sendTransactionAsync(staking, {
                    from: owner,
                }),
            );

            // Verify that the staking address was actually updated to the correct address.
            const updated = await exchange.staking.callAsync();
            expect(updated).to.be.eq(staking);

            // Ensure that the correct `UpdatedStakingAddress` event was logged.
            // tslint:disable:no-unnecessary-type-assertion
            const updatedEvent = receipt.logs[0] as LogWithDecodedArgs<ExchangeUpdatedStakingAddressEventArgs>;
            expect(updatedEvent.event).to.be.eq('UpdatedStakingAddress');
            expect(updatedEvent.args.oldStaking).to.be.eq(constants.NULL_ADDRESS);
            expect(updatedEvent.args.updatedStaking).to.be.eq(staking);
        });
    });
});
