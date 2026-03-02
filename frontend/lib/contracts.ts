import { arbitrumSepolia } from 'wagmi/chains'
import { MarketFactoryAbi } from './abis/MarketFactory'
import { PrivacyPoolAbi } from './abis/PrivacyPool'
import { ClaimRegistryAbi } from './abis/ClaimRegistry'

export const CHAIN = arbitrumSepolia

export const CONTRACTS = {
  factory: {
    address: (process.env.NEXT_PUBLIC_FACTORY_ADDRESS ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
    abi: MarketFactoryAbi,
  },
  pool: {
    address: (process.env.NEXT_PUBLIC_POOL_ADDRESS ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
    abi: PrivacyPoolAbi,
  },
  registry: {
    address: (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
    abi: ClaimRegistryAbi,
  },
} as const
