import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSuiNetwork() {
  try {
    console.log('Checking SUI network configuration...');

    const suiNetwork = await prisma.networkConfig.findFirst({
      where: { network: 'SUI' }
    });

    if (suiNetwork) {
      console.log('SUI network found:', JSON.stringify(suiNetwork, null, 2));

      if (!suiNetwork.contractDeployed) {
        console.log('\nSUI network exists but contract is not marked as deployed.');
        console.log('Updating SUI network with contract information...');

        const updated = await prisma.networkConfig.update({
          where: { id: suiNetwork.id },
          data: {
            contractDeployed: true,
            contractAddress: '0xd3c5601b3110dad07821c27050dfc873a04f48e172463fba7cca5a5aa2b489cd',
            lastContractCheck: new Date(),
          },
        });

        console.log('SUI network updated successfully:', JSON.stringify(updated, null, 2));
      } else {
        console.log('\nSUI network is already configured with contract deployment.');
      }
    } else {
      console.log('SUI network not found in database.');
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkSuiNetwork();
