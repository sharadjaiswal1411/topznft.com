import {
  Dispatch,
  FC,
  SetStateAction,
  useEffect,
  useRef,
  useContext,
  useState,
} from 'react'
import { useMediaQuery } from 'react-responsive'
import {
  Text,
  Flex,
  TableCell,
  TableRow,
  HeaderRow,
  Tooltip,
  FormatCryptoCurrency,
  Button,
  Box,
} from '../primitives'
import { List, AcceptBid } from 'components/buttons'
import Image from 'next/image'
import { useIntersectionObserver } from 'usehooks-ts'
import LoadingSpinner from '../common/LoadingSpinner'
import {
  EditListingModal,
  EditListingStep,
  useTokens,
  useUserTokens,
} from '@reservoir0x/reservoir-kit-ui'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBolt,
  faCircleInfo,
  faEdit,
  faEllipsis,
  faGasPump,
  faMagnifyingGlass,
  faRefresh,
} from '@fortawesome/free-solid-svg-icons'
import Link from 'next/link'
import { MutatorCallback } from 'swr'
import { Address } from 'wagmi'
import { useMarketplaceChain } from 'hooks'
import { NAVBAR_HEIGHT } from 'components/navbar'
import Checkbox from 'components/primitives/Checkbox'
import { UserToken } from 'pages/portfolio'
import { ChainContext } from 'context/ChainContextProvider'
import { Dropdown, DropdownMenuItem } from 'components/primitives/Dropdown'
import { PortfolioSortingOption } from 'components/common/PortfolioSortDropdown'
import { zoneAddresses } from 'utils/zoneAddresses'
import CancelListing from 'components/buttons/CancelListing'
import { ToastContext } from 'context/ToastContextProvider'
import fetcher from 'utils/fetcher'
import { DATE_REGEX, timeTill } from 'utils/till'
import { spin } from 'components/common/LoadingSpinner'
import { formatDollar } from 'utils/numbers'
import { OpenSeaVerified } from 'components/common/OpenSeaVerified'

type Props = {
  address: Address | undefined
  filterCollection: string | undefined
  sortBy: PortfolioSortingOption
  isLoading?: boolean
  selectedItems: UserToken[]
  setSelectedItems: Dispatch<SetStateAction<UserToken[]>>
}

const desktopTemplateColumns = '1.25fr repeat(3, .75fr) 1.5fr'

export const TokenTable: FC<Props> = ({
  address,
  isLoading,
  sortBy,
  filterCollection,
  selectedItems,
  setSelectedItems,
}) => {
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const loadMoreObserver = useIntersectionObserver(loadMoreRef, {})

  let tokenQuery: Parameters<typeof useUserTokens>['1'] = {
    limit: 20,
    sortBy: sortBy,
    collection: filterCollection,
    includeTopBid: true,
    includeRawData: true,
    includeAttributes: true,
  }

  const { chain } = useContext(ChainContext)

  if (chain.collectionSetId) {
    tokenQuery.collectionsSetId = chain.collectionSetId
  } else if (chain.community) {
    tokenQuery.community = chain.community
  }

  const {
    data: tokens,
    fetchNextPage,
    mutate,
    isFetchingPage,
    isValidating,
  } = useUserTokens(address, tokenQuery, {})

  useEffect(() => {
    const isVisible = !!loadMoreObserver?.isIntersecting
    if (isVisible) {
      fetchNextPage()
    }
  }, [loadMoreObserver?.isIntersecting])

  return (
    <>
      {!isValidating && !isFetchingPage && tokens && tokens.length === 0 ? (
        <Flex
          direction="column"
          align="center"
          css={{ py: '$6', gap: '$4', width: '100%' }}
        >
          <Text css={{ color: '$gray11' }}>
            <FontAwesomeIcon icon={faMagnifyingGlass} size="2xl" />
          </Text>
          <Text css={{ color: '$gray11' }}>No items found</Text>
        </Flex>
      ) : (
        <Flex direction="column" css={{ width: '100%' }}>
          {isLoading ? null : (
            <>
              <TableHeading />
              {tokens.map((token, i) => {
                if (!token) return null

                return (
                  <TokenTableRow
                    key={`${token.token?.tokenId}-${i}`}
                    token={token}
                    mutate={mutate}
                    selectedItems={selectedItems}
                    setSelectedItems={setSelectedItems}
                  />
                )
              })}
            </>
          )}
          <div ref={loadMoreRef}></div>
        </Flex>
      )}
      {isValidating && (
        <Flex align="center" justify="center" css={{ py: '$6' }}>
          <LoadingSpinner />
        </Flex>
      )}
    </>
  )
}

type TokenTableRowProps = {
  token: ReturnType<typeof useUserTokens>['data'][0]
  mutate?: MutatorCallback
  selectedItems: UserToken[]
  setSelectedItems: Dispatch<SetStateAction<UserToken[]>>
}

const TokenTableRow: FC<TokenTableRowProps> = ({
  token,
  mutate,
  selectedItems,
  setSelectedItems,
}) => {
  const { routePrefix, proxyApi } = useMarketplaceChain()
  const { addToast } = useContext(ToastContext)

  const [isRefreshing, setIsRefreshing] = useState(false)
  const isSmallDevice = useMediaQuery({ maxWidth: 900 })

  const addSelectedItem = (item: UserToken) => {
    setSelectedItems([...selectedItems, item])
  }

  const removeSelectedItem = (item: UserToken) => {
    setSelectedItems(
      selectedItems.filter(
        (selectedItem) =>
          selectedItem?.token?.tokenId !== item?.token?.tokenId ||
          selectedItem?.token?.contract !== item?.token?.contract
      )
    )
  }

  const isSelectedItem = (item: UserToken) => {
    return selectedItems.some(
      (selectedItem) =>
        selectedItem?.token?.tokenId === item?.token?.tokenId &&
        selectedItem?.token?.contract === item?.token?.contract
    )
  }

  const itemId = `${token?.token?.contract}/${token?.token?.tokenId}`

  let imageSrc: string = (
    token?.token?.tokenId
      ? token?.token?.image || token?.token?.collection?.imageUrl
      : token?.token?.collection?.imageUrl
  ) as string

  const orderZone = token?.ownership?.floorAsk?.rawData?.zone
  // @ts-ignore
  const orderKind = token?.ownership?.floorAsk?.kind

  const isOracleOrder =
    orderKind === 'seaport-v1.4' && zoneAddresses.includes(orderZone as string)

  const contract = token.token?.collection?.id
    ? token.token?.collection.id?.split(':')[0]
    : undefined

  if (isSmallDevice) {
    return (
      <Flex
        key={token?.token?.tokenId}
        direction="column"
        align="start"
        css={{
          gap: '$3',
          borderBottom: '1px solid $gray3',
          py: '$3',
          width: '100%',
          overflow: 'hidden',
          flex: 1,
        }}
      >
        <Link
          href={`/collection/${routePrefix}/${token?.token?.contract}/${token?.token?.tokenId}`}
        >
          <Flex align="center">
            {imageSrc && (
              <Image
                style={{
                  borderRadius: '4px',
                  objectFit: 'cover',
                  aspectRatio: '1/1',
                }}
                loader={({ src }) => src}
                src={imageSrc}
                alt={`${token?.token?.name}`}
                width={36}
                height={36}
              />
            )}
            <Flex
              direction="column"
              css={{
                ml: '$2',
                overflow: 'hidden',
                minWidth: 0,
              }}
            >
              <Text style="subtitle3" ellipsify color="subtle">
                {token?.token?.collection?.name}
              </Text>
              <Text style="subtitle2" ellipsify>
                #{token?.token?.tokenId}
              </Text>
            </Flex>
          </Flex>
        </Link>
        <Flex justify="between" css={{ width: '100%', gap: '$3' }}>
          <Flex direction="column" align="start" css={{ width: '100%' }}>
            <Text style="subtitle3" color="subtle">
              Net Floor
            </Text>
            <FormatCryptoCurrency
              amount={
                token?.token?.collection?.floorAskPrice?.netAmount?.decimal
              }
              address={
                token?.token?.collection?.floorAskPrice?.currency?.contract
              }
              decimals={
                token?.token?.collection?.floorAskPrice?.currency?.decimals
              }
              textStyle="subtitle2"
              logoHeight={14}
            />
            <List
              token={token as ReturnType<typeof useTokens>['data'][0]}
              mutate={mutate}
              buttonCss={{
                width: '100%',
                maxWidth: '300px',
                justifyContent: 'center',
                px: '42px',
                backgroundColor: '$gray3',
                color: '$gray12',
                mt: '$2',
                '&:hover': {
                  backgroundColor: '$gray4',
                },
              }}
              buttonChildren="List"
            />
          </Flex>
          <Flex direction="column" align="start" css={{ width: '100%' }}>
            <Text style="subtitle3" color="subtle">
              You Get
            </Text>
            <FormatCryptoCurrency
              amount={token?.token?.topBid?.price?.netAmount?.native}
              textStyle="subtitle2"
              logoHeight={14}
            />
            {token?.token?.topBid?.price?.amount?.decimal && (
              <AcceptBid
                tokenId={token.token.tokenId}
                collectionId={token?.token?.contract}
                mutate={mutate}
                buttonCss={{
                  width: '100%',
                  maxWidth: '300px',
                  justifyContent: 'center',
                  px: '32px',
                  backgroundColor: '$primary9',
                  color: 'white',
                  mt: '$2',
                  '&:hover': {
                    backgroundColor: '$primary10',
                  },
                }}
                buttonChildren={
                  <Flex align="center" css={{ gap: '$2' }}>
                    <FontAwesomeIcon icon={faBolt} />
                    Sell
                  </Flex>
                }
              />
            )}
          </Flex>
        </Flex>
      </Flex>
    )
  }

  return (
    <TableRow
      key={token?.token?.tokenId}
      css={{ gridTemplateColumns: desktopTemplateColumns }}
    >
      <TableCell css={{ minWidth: 0, overflow: 'hidden' }}>
        <Flex align="center" css={{ gap: '$3' }}>
          <Checkbox
            checked={isSelectedItem(token)}
            onCheckedChange={(checked) => {
              if (checked) {
                addSelectedItem(token)
              } else {
                removeSelectedItem(token)
              }
            }}
          />
          <Link
            href={`/collection/${routePrefix}/${token?.token?.contract}/${token?.token?.tokenId}`}
          >
            <Flex align="center">
              {imageSrc && (
                <Image
                  style={{
                    borderRadius: '4px',
                    objectFit: 'cover',
                    aspectRatio: '1/1',
                  }}
                  loader={({ src }) => src}
                  src={imageSrc}
                  alt={`${token?.token?.name}`}
                  width={48}
                  height={48}
                />
              )}
              <Flex
                direction="column"
                css={{
                  ml: '$2',
                  overflow: 'hidden',
                }}
              >
                <Flex justify="between" align="center" css={{ gap: '$2' }}>
                  <Text style="subtitle3" ellipsify color="subtle">
                    {token?.token?.collection?.name}
                  </Text>
                  {token?.token?.kind === 'erc1155' &&
                    token?.ownership?.tokenCount && (
                      <Flex
                        justify="center"
                        align="center"
                        css={{
                          borderRadius: 9999,
                          backgroundColor: '$gray4',
                          maxWidth: '50%',
                        }}
                      >
                        <Text
                          ellipsify
                          style="subtitle3"
                          css={{ px: '$2', fontSize: 10 }}
                        >
                          x{token?.ownership?.tokenCount}
                        </Text>
                      </Flex>
                    )}
                  <OpenSeaVerified
                    openseaVerificationStatus={
                      token?.token?.collection?.openseaVerificationStatus
                    }
                  />
                </Flex>
                <Text style="subtitle2" ellipsify>
                  #{token?.token?.tokenId}
                </Text>
              </Flex>
            </Flex>
          </Link>
        </Flex>
      </TableCell>
      <TableCell>
        <FormatCryptoCurrency
          amount={token?.ownership?.floorAsk?.price?.amount?.decimal}
          textStyle="subtitle1"
          logoHeight={14}
        />
      </TableCell>
      <TableCell>
        <FormatCryptoCurrency
          amount={token?.token?.collection?.floorAskPrice?.netAmount?.decimal}
          address={token?.token?.collection?.floorAskPrice?.currency?.contract}
          decimals={token?.token?.collection?.floorAskPrice?.currency?.decimals}
          textStyle="subtitle1"
          logoHeight={14}
        />
      </TableCell>
      <TableCell>
        <Flex direction="column" align="start">
          <FormatCryptoCurrency
            amount={token?.token?.topBid?.price?.netAmount?.native}
            address={token?.token?.topBid?.price?.currency?.contract}
            decimals={token?.token?.topBid?.price?.currency?.decimals}
            textStyle="subtitle2"
            logoHeight={14}
          />
          {token?.token?.topBid?.price?.amount?.usd ? (
            <Text style="subtitle3"  css={{ color: '$gray11' }} ellipsify>
              {formatDollar(token?.token?.topBid?.price?.amount?.usd as number)}
            </Text>
          ) : null}
        </Flex>
      </TableCell>
      <TableCell>
        <Flex justify="end" css={{ gap: '$3' }}>
          {token?.token?.topBid?.price?.amount?.decimal && (
            <AcceptBid
              tokenId={token.token.tokenId}
              collectionId={token?.token?.contract}
              buttonCss={{
                px: '32px',
                backgroundColor: '$primary9',
                color: 'white',
                '&:hover': {
                  backgroundColor: '$primary10',
                },
              }}
              buttonChildren={
                <Flex align="center" css={{ gap: '$2' }}>
                  <FontAwesomeIcon icon={faBolt} />
                  Sell
                </Flex>
              }
              mutate={mutate}
            />
          )}

          <List
            token={token as ReturnType<typeof useTokens>['data'][0]}
            buttonCss={{
              px: '42px',
              backgroundColor: '$gray3',
              color: '$gray12',
              '&:hover': {
                backgroundColor: '$gray4',
              },
            }}
            buttonChildren="List"
            mutate={mutate}
          />
          <Dropdown
            modal={false}
            trigger={
              <Button
                color="gray3"
                size="xs"
                css={{ width: 44, justifyContent: 'center' }}
              >
                <FontAwesomeIcon icon={faEllipsis} />
              </Button>
            }
            contentProps={{ asChild: true, forceMount: true }}
          >
            <DropdownMenuItem
              css={{ py: '$3', width: '100%' }}
              onClick={(e) => {
                if (isRefreshing) {
                  e.preventDefault()
                  return
                }
                setIsRefreshing(true)
                fetcher(
                  `${window.location.origin}/${proxyApi}/tokens/refresh/v1`,
                  undefined,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      token: `${contract}:${token.token?.tokenId}`,
                    }),
                  }
                )
                  .then(({ data, response }) => {
                    if (response.status === 200) {
                      addToast?.({
                        title: 'Refresh token',
                        description:
                          'Request to refresh this token was accepted.',
                      })
                    } else {
                      throw data
                    }
                    setIsRefreshing(false)
                  })
                  .catch((e) => {
                    const ratelimit = DATE_REGEX.exec(e?.message)?.[0]

                    addToast?.({
                      title: 'Refresh token failed',
                      description: ratelimit
                        ? `This token was recently refreshed. The next available refresh is ${timeTill(
                            ratelimit
                          )}.`
                        : `This token was recently refreshed. Please try again later.`,
                    })

                    setIsRefreshing(false)
                    throw e
                  })
              }}
            >
              <Flex align="center" css={{ gap: '$2' }}>
                <Box
                  css={{
                    color: '$gray10',
                    animation: isRefreshing
                      ? `${spin} 1s cubic-bezier(0.76, 0.35, 0.2, 0.7) infinite`
                      : 'none',
                  }}
                >
                  <FontAwesomeIcon icon={faRefresh} width={16} height={16} />
                </Box>
                <Text>Refresh</Text>
              </Flex>
            </DropdownMenuItem>

            {isOracleOrder &&
            token?.ownership?.floorAsk?.id &&
            token?.token?.tokenId &&
            token?.token?.collection?.id ? (
              <EditListingModal
                trigger={
                  <Flex
                    align="center"
                    css={{
                      gap: '$2',
                      px: '$2',
                      py: '$3',
                      borderRadius: 8,
                      outline: 'none',
                      cursor: 'pointer',
                      '&:hover': {
                        backgroundColor: '$gray5',
                      },
                      '&:focus': {
                        backgroundColor: '$gray5',
                      },
                    }}
                  >
                    <Box css={{ color: '$gray10' }}>
                      <FontAwesomeIcon icon={faEdit} />
                    </Box>
                    <Text>Edit Listing</Text>
                  </Flex>
                }
                listingId={token?.ownership?.floorAsk?.id}
                tokenId={token?.token?.tokenId}
                collectionId={token?.token?.collection?.id}
                onClose={(data, currentStep) => {
                  if (mutate && currentStep == EditListingStep.Complete)
                    mutate()
                }}
              />
            ) : null}

            {token?.ownership?.floorAsk?.id ? (
              <CancelListing
                listingId={token.ownership.floorAsk.id as string}
                mutate={mutate}
                trigger={
                  <Flex
                    css={{
                      px: '$2',
                      py: '$3',
                      borderRadius: 8,
                      outline: 'none',
                      cursor: 'pointer',
                      '&:hover': {
                        backgroundColor: '$gray5',
                      },
                      '&:focus': {
                        backgroundColor: '$gray5',
                      },
                    }}
                  >
                    {!isOracleOrder ? (
                      <Tooltip
                        content={
                          <Text style="body2" as="p">
                            Cancelling this order requires gas.
                          </Text>
                        }
                      >
                        <Flex align="center" css={{ gap: '$2' }}>
                          <Box css={{ color: '$gray10' }}>
                            <FontAwesomeIcon icon={faGasPump} />
                          </Box>
                          <Text color="error">Cancel</Text>
                        </Flex>
                      </Tooltip>
                    ) : (
                      <Text color="error">Cancel</Text>
                    )}
                  </Flex>
                }
              />
            ) : null}
          </Dropdown>
        </Flex>
      </TableCell>
    </TableRow>
  )
}

const TableHeading = () => (
  <HeaderRow
    css={{
      display: 'none',
      '@md': { display: 'grid' },
      gridTemplateColumns: desktopTemplateColumns,
      position: 'sticky',
      top: NAVBAR_HEIGHT,
      backgroundColor: '$neutralBg',
    }}
  >
    <TableCell>
      <Text style="subtitle3" color="subtle">
        Items
      </Text>
    </TableCell>
    <TableCell>
      <Text style="subtitle3" color="subtle">
        Listed Price
      </Text>
    </TableCell>
    <TableCell>
      <Flex align="center" css={{ gap: '$2' }}>
        <Text style="subtitle3" color="subtle">
          Net Floor
        </Text>
        <Tooltip
          content={
            <Flex>
              <Text style="body3" css={{ mx: '$2', maxWidth: '200px' }}>
                The floor price with royalties and fees removed. This is the eth
                you would receive if you listed at the floor.
              </Text>
            </Flex>
          }
        >
          <Text css={{ color: '$gray9' }}>
            <FontAwesomeIcon icon={faCircleInfo} width={12} height={12} />
          </Text>
        </Tooltip>
      </Flex>
    </TableCell>
    <TableCell>
      <Flex align="center" css={{ gap: '$2' }}>
        <Text style="subtitle3" color="subtle">
          You Get
        </Text>
        <Tooltip
          content={
            <Flex>
              <Text style="body3" css={{ mx: '$2', maxWidth: '200px' }}>
                The eth you would receive if you sold instantly.
              </Text>
            </Flex>
          }
        >
          <Text css={{ color: '$gray9' }}>
            <FontAwesomeIcon icon={faCircleInfo} width={12} height={12} />
          </Text>
        </Tooltip>
      </Flex>
    </TableCell>
    <TableCell></TableCell>
  </HeaderRow>
)
