import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.14.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

Clarinet.test({
    name: "Ensure that NFT minting works correctly",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const user1 = accounts.get('wallet_1')!;
        
        let block = chain.mineBlock([
            Tx.contractCall(
                'charity-nft-platform',
                'mint',
                [
                    types.utf8('ipfs://QmXaXFRbCNJJnKJMrNvUzqSPxZJ28XZVk8NqzAQtesTHCi'),
                    types.utf8('Artwork')
                ],
                user1.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok u1)'); // First NFT should have ID 1
        
        // Verify token ownership
        const tokenOwner = chain.callReadOnlyFn(
            'charity-nft-platform',
            'get-owner',
            [types.uint(1)],
            user1.address
        );
        
        assertEquals(tokenOwner.result, `(some ${user1.address})`);
        
        // Verify token URI
        const tokenUri = chain.callReadOnlyFn(
            'charity-nft-platform',
            'get-token-uri',
            [types.uint(1)],
            user1.address
        );
        
        assertEquals(tokenUri.result, `(some u"ipfs://QmXaXFRbCNJJnKJMrNvUzqSPxZJ28XZVk8NqzAQtesTHCi")`);
        
        // Verify token metadata
        const tokenMetadata = chain.callReadOnlyFn(
            'charity-nft-platform',
            'get-token-metadata',
            [types.uint(1)],
            user1.address
        );
        
        const metadataJson = tokenMetadata.result.expectSome().expectTuple();
        assertEquals(metadataJson['creator'], user1.address);
        assertEquals(metadataJson['category'], types.utf8('Artwork'));
    },
});

Clarinet.test({
    name: "Ensure that NFT transfer works correctly",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const user1 = accounts.get('wallet_1')!; // original owner
        const user2 = accounts.get('wallet_2')!; // new owner
        
        // First, mint an NFT
        let block = chain.mineBlock([
            Tx.contractCall(
                'charity-nft-platform',
                'mint',
                [
                    types.utf8('ipfs://QmXaXFRbCNJJnKJMrNvUzqSPxZJ28XZVk8NqzAQtesTHCi'),
                    types.utf8('Artwork')
                ],
                user1.address
            )
        ]);
        
        // Transfer the NFT
        block = chain.mineBlock([
            Tx.contractCall(
                'charity-nft-platform',
                'transfer',
                [
                    types.uint(1), // token ID
                    types.principal(user2.address) // recipient
                ],
                user1.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');
        
        // Verify the new owner
        const tokenOwner = chain.callReadOnlyFn(
            'charity-nft-platform',
            'get-owner',
            [types.uint(1)],
            user1.address
        );
        
        assertEquals(tokenOwner.result, `(some ${user2.address})`);
    },
});

Clarinet.test({
    name: "Ensure that NFT listing for sale works correctly",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const user1 = accounts.get('wallet_1')!;
        
        // First, mint an NFT
        let block = chain.mineBlock([
            Tx.contractCall(
                'charity-nft-platform',
                'mint',
                [
                    types.utf8('ipfs://QmXaXFRbCNJJnKJMrNvUzqSPxZJ28XZVk8NqzAQtesTHCi'),
                    types.utf8('Artwork')
                ],
                user1.address
            )
        ]);
        
        // List the NFT for sale
        block = chain.mineBlock([
            Tx.contractCall(
                'charity-nft-platform',
                'list-for-sale',
                [
                    types.uint(1), // token ID
                    types.uint(1000000) // price (1 STX)
                ],
                user1.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');
        
        // Verify the listing price
        const nftPrice = chain.callReadOnlyFn(
            'charity-nft-platform',
            'get-price',
            [types.uint(1)],
            user1.address
        );
        
        assertEquals(nftPrice.result, '(some u1000000)');
    },
});

Clarinet.test({
    name: "Ensure that charity campaign creation works correctly",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        
        let block = chain.mineBlock([
            Tx.contractCall(
                'charity-nft-platform',
                'create-charity-campaign',
                [
                    types.utf8('Clean Water Initiative'),
                    types.utf8('Providing clean water to communities in need'),
                    types.uint(10000000), // goal (10 STX)
                    types.uint(1440) // duration (10 days in blocks)
                ],
                deployer.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok u1)'); // First campaign should have ID 1
        
        // Verify campaign details
        const campaignDetails = chain.callReadOnlyFn(
            'charity-nft-platform',
            'get-campaign-details',
            [types.uint(1)],
            deployer.address
        );
        
        const campaignJson = campaignDetails.result.expectSome().expectTuple();
        assertEquals(campaignJson['name'], types.utf8('Clean Water Initiative'));
        assertEquals(campaignJson['goal'], types.uint(10000000));
        assertEquals(campaignJson['raised'], types.uint(0));
        assertEquals(campaignJson['active'], types.bool(true));
    },
});

Clarinet.test({
    name: "Ensure that only the contract owner can create campaigns",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const user1 = accounts.get('wallet_1')!;
        
        let block = chain.mineBlock([
            Tx.contractCall(
                'charity-nft-platform',
                'create-charity-campaign',
                [
                    types.utf8('Unauthorized Campaign'),
                    types.utf8('This should fail'),
                    types.uint(10000000),
                    types.uint(1440)
                ],
                user1.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u100)'); // err-owner-only
    },
});

Clarinet.test({
    name: "Ensure that donation to campaign works correctly",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const user1 = accounts.get('wallet_1')!;
        
        // First, create a campaign
        let block = chain.mineBlock([
            Tx.contractCall(
                'charity-nft-platform',
                'create-charity-campaign',
                [
                    types.utf8('Education Fund'),
                    types.utf8('Supporting education in underserved areas'),
                    types.uint(10000000),
                    types.uint(1440)
                ],
                deployer.address
            )
        ]);
        
        // Make a donation
        block = chain.mineBlock([
            Tx.contractCall(
                'charity-nft-platform',
                'donate-to-campaign',
                [
                    types.uint(1), // campaign ID
                    types.uint(500000) // donation amount (0.5 STX)
                ],
                user1.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');
        
        // Verify campaign raised amount
        const campaignDetails = chain.callReadOnlyFn(
            'charity-nft-platform',
            'get-campaign-details',
            [types.uint(1)],
            deployer.address
        );
        
        const campaignJson = campaignDetails.result.expectSome().expectTuple();
        assertEquals(campaignJson['raised'], types.uint(500000));
        
        // Verify donation history
        const donationHistory = chain.callReadOnlyFn(
            'charity-nft-platform',
            'get-user-donation-history',
            [
                types.principal(user1.address),
                types.uint(1)
            ],
            user1.address
        );
        
        const donationJson = donationHistory.result.expectSome().expectTuple();
        assertEquals(donationJson['amount'], types.uint(500000));
    },
});

Clarinet.test({
    name: "Ensure that NFT buying with charity donation works correctly",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const user1 = accounts.get('wallet_1')!; // NFT creator/seller
        const user2 = accounts.get('wallet_2')!; // NFT buyer
        
        // First, mint an NFT
        let block = chain.mineBlock([
            Tx.contractCall(
                'charity-nft-platform',
                'mint',
                [
                    types.utf8('ipfs://QmXaXFRbCNJJnKJMrNvUzqSPxZJ28XZVk8NqzAQtesTHCi'),
                    types.utf8('Artwork')
                ],
                user1.address
            )
        ]);
        
        // List the NFT for sale
        block = chain.mineBlock([
            Tx.contractCall(
                'charity-nft-platform',
                'list-for-sale',
                [
                    types.uint(1), // token ID
                    types.uint(1000000) // price (1 STX)
                ],
                user1.address
            )
        ]);
        
        // Buy the NFT
        block = chain.mineBlock([
            Tx.contractCall(
                'charity-nft-platform',
                'buy-nft',
                [types.uint(1)], // token ID
                user2.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');
        
        // Verify the new owner
        const tokenOwner = chain.callReadOnlyFn(
            'charity-nft-platform',
            'get-owner',
            [types.uint(1)],
            user2.address
        );
        
        assertEquals(tokenOwner.result, `(some ${user2.address})`);
        
        // Verify the price has been removed (token no longer for sale)
        const nftPrice = chain.callReadOnlyFn(
            'charity-nft-platform',
            'get-price',
            [types.uint(1)],
            user2.address
        );
        
        assertEquals(nftPrice.result, 'none');
    },
});

Clarinet.test({
    name: "Ensure administrative functions work correctly",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const user1 = accounts.get('wallet_1')!;
        const newCharityAddress = accounts.get('wallet_3')!;
        
        // Set charity address
        let block = chain.mineBlock([
            Tx.contractCall(
                'charity-nft-platform',
                'set-charity-address',
                [types.principal(newCharityAddress.address)],
                deployer.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');
        
        // Set donation percentage
        block = chain.mineBlock([
            Tx.contractCall(
                'charity-nft-platform',
                'set-donation-percentage',
                [types.uint(30)], // 30%
                deployer.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');
        
        // Toggle pause
        block = chain.mineBlock([
            Tx.contractCall(
                'charity-nft-platform',
                'toggle-pause',
                [],
                deployer.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');
        
        // Verify pause prevents minting
        block = chain.mineBlock([
            Tx.contractCall(
                'charity-nft-platform',
                'mint',
                [
                    types.utf8('ipfs://QmTest'),
                    types.utf8('Test')
                ],
                user1.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u108)'); // paused error
    },
});

Clarinet.test({
    name: "Ensure that unauthorized users cannot perform admin functions",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const user1 = accounts.get('wallet_1')!;
        
        // Try to set charity address
        let block = chain.mineBlock([
            Tx.contractCall(
                'charity-nft-platform',
                'set-charity-address',
                [types.principal(user1.address)],
                user1.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u100)'); // err-owner-only
    },
});

Clarinet.test({
    name: "Ensure campaign end functionality works correctly",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        
        // First, create a campaign
        let block = chain.mineBlock([
            Tx.contractCall(
                'charity-nft-platform',
                'create-charity-campaign',
                [
                    types.utf8('Test Campaign'),
                    types.utf8('For testing'),
                    types.uint(1000000),
                    types.uint(144)
                ],
                deployer.address
            )
        ]);
        
        // End the campaign
        block = chain.mineBlock([
            Tx.contractCall(
                'charity-nft-platform',
                'end-campaign',
                [types.uint(1)],
                deployer.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');
        
        // Verify campaign is inactive
        const campaignDetails = chain.callReadOnlyFn(
            'charity-nft-platform',
            'get-campaign-details',
            [types.uint(1)],
            deployer.address
        );
        
        const campaignJson = campaignDetails.result.expectSome().expectTuple();
        assertEquals(campaignJson['active'], types.bool(false));
    },
});

Clarinet.test({
    name: "Ensure NFT donation to campaign works correctly",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const user1 = accounts.get('wallet_1')!;
        
        // First, create a campaign
        let block = chain.mineBlock([
            Tx.contractCall(
                'charity-nft-platform',
                'create-charity-campaign',
                [
                    types.utf8('NFT Donation Campaign'),
                    types.utf8('Support by donating NFTs'),
                    types.uint(10000000),
                    types.uint(1440)
                ],
                deployer.address
            )
        ]);
        
        // Mint an NFT
        block = chain.mineBlock([
            Tx.contractCall(
                'charity-nft-platform',
                'mint',
                [
                    types.utf8('ipfs://QmDonationNFT'),
                    types.utf8('Charity')
                ],
                user1.address
            )
        ]);
        
        // List the NFT for a price
        block = chain.mineBlock([
            Tx.contractCall(
                'charity-nft-platform',
                'list-for-sale',
                [
                    types.uint(1), // token ID
                    types.uint(500000) // price (0.5 STX)
                ],
                user1.address
            )
        ]);
        
        // Donate the NFT to the campaign
        block = chain.mineBlock([
            Tx.contractCall(
                'charity-nft-platform',
                'donate-nft-to-campaign',
                [
                    types.uint(1), // token ID
                    types.uint(1)  // campaign ID
                ],
                user1.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');
        
        // Verify campaign NFTs
        const campaignNfts = chain.callReadOnlyFn(
            'charity-nft-platform',
            'get-campaign-nfts',
            [types.uint(1)],
            user1.address
        );
        
        // Should contain the donated NFT
        const nftsList = campaignNfts.result.expectSome().expectList();
        assertEquals(nftsList.length, 1);
        assertEquals(nftsList[0], types.uint(1));
        
        // Verify user campaign participation
        const userStats = chain.callReadOnlyFn(
            'charity-nft-platform',
            'get-user-campaign-stats',
            [
                types.principal(user1.address),
                types.uint(1)
            ],
            user1.address
        );
        
        const statsJson = userStats.result.expectSome().expectTuple();
        assertEquals(statsJson['total-value'], types.uint(500000)); // Value of the NFT
        
        // Verify campaign raised amount includes NFT value
        const campaignDetails = chain.callReadOnlyFn(
            'charity-nft-platform',
            'get-campaign-details',
            [types.uint(1)],
            deployer.address
        );
        
        const campaignJson = campaignDetails.result.expectSome().expectTuple();
        assertEquals(campaignJson['raised'], types.uint(500000)); // Value of the NFT
        
        // Verify NFT ownership transferred to contract
        const tokenOwner = chain.callReadOnlyFn(
            'charity-nft-platform',
            'get-owner',
            [types.uint(1)],
            user1.address
        );
        
        assertEquals(tokenOwner.result, `(some ${deployer.address})`); // Contract owner now owns the NFT
    },
});

Clarinet.test({
    name: "Ensure campaign milestones can be added and verified",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        
        // First, create a campaign
        let block = chain.mineBlock([
            Tx.contractCall(
                'charity-nft-platform',
                'create-charity-campaign',
                [
                    types.utf8('Milestone Campaign'),
                    types.utf8('Campaign with milestones'),
                    types.uint(10000000),
                    types.uint(1440)
                ],
                deployer.address
            )
        ]);
        
        // Add a milestone
        block = chain.mineBlock([
            Tx.contractCall(
                'charity-nft-platform',
                'add-campaign-milestone',
                [
                    types.uint(1), // campaign ID
                    types.uint(1), // milestone ID
                    types.utf8('First milestone: 25% of goal'),
                    types.uint(2500000), // 25% of 10 STX goal
                    types.utf8('ipfs://QmMilestoneBadge1')
                ],
                deployer.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');
        
        // Verify milestone details
        const milestone = chain.callReadOnlyFn(
            'charity-nft-platform',
            'get-campaign-milestone',
            [
                types.uint(1), // campaign ID
                types.uint(1)  // milestone ID
            ],
            deployer.address
        );
        
        const milestoneJson = milestone.result.expectSome().expectTuple();
        assertEquals(milestoneJson['description'], types.utf8('First milestone: 25% of goal'));
        assertEquals(milestoneJson['target-amount'], types.uint(2500000));
        assertEquals(milestoneJson['reached'], types.bool(false));
        assertEquals(milestoneJson['reward-uri'], types.utf8('ipfs://QmMilestoneBadge1'));
    },
});

Clarinet.test({
    name: "Ensure error handling works for invalid operations",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const user1 = accounts.get('wallet_1')!;
        const user2 = accounts.get('wallet_2')!;
        
        // Try to transfer non-existent NFT
        let block = chain.mineBlock([
            Tx.contractCall(
                'charity-nft-platform',
                'transfer',
                [
                    types.uint(999), // non-existent token ID
                    types.principal(user2.address)
                ],
                user1.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u1)'); // NFT not found
        
        // Mint an NFT
        block = chain.mineBlock([
            Tx.contractCall(
                'charity-nft-platform',
                'mint',
                [
                    types.utf8('ipfs://QmTest'),
                    types.utf8('Test')
                ],
                user1.address
            )
        ]);
        
        // Try to transfer someone else's NFT
        block = chain.mineBlock([
            Tx.contractCall(
                'charity-nft-platform',
                'transfer',
                [
                    types.uint(1), // token ID
                    types.principal(user2.address)
                ],
                user2.address // Not the owner
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u101)'); // err-not-token-owner
        
        // Try to donate to non-existent campaign
        block = chain.mineBlock([
            Tx.contractCall(
                'charity-nft-platform',
                'donate-to-campaign',
                [
                    types.uint(999), // non-existent campaign
                    types.uint(1000000)
                ],
                user1.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u104)'); // err-campaign-not-found
    },
});