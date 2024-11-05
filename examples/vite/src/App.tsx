import {
  AoArNSNameData,
  AoArNSNameDataWithName,
  AoAuction,
  AoAuctionPriceData,
  AoGateway,
  AoGatewayWithAddress,
  IO,
  IO_DEVNET_PROCESS_ID,
  PaginationResult,
} from '@ar.io/sdk/web';
import { useEffect, useState } from 'react';
import {
  Label,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import './App.css';

const io = IO.init({ processId: IO_DEVNET_PROCESS_ID });

type AuctionWithPrices = AoAuction & {
  prices: { timestamp: string; price: number }[];
  currentPrice: number;
};

function App() {
  const [auctions, setAuctions] = useState<AoAuction[]>([]);
  const [selectedAuction, setSelectedAuction] =
    useState<AuctionWithPrices | null>(null);
  const [names, setNames] = useState<AoArNSNameDataWithName[]>([]);
  const [gateways, setGateways] = useState<AoGatewayWithAddress[]>([]);
  const [totalGateways, setTotalGateways] = useState<number>(0);
  const [totalNames, setTotalNames] = useState<number>(0);
  const [totalAuctions, setTotalAuctions] = useState<number>(0);

  useEffect(() => {
    // fetch first page of arns names
    io.getArNSRecords({ limit: 10 }).then(
      (page: PaginationResult<AoArNSNameDataWithName>) => {
        setNames(page.items);
        setTotalNames(page.totalItems);
      },
    );

    // fetch first page of gateways
    io.getGateways({ limit: 10 }).then(
      (page: PaginationResult<AoGatewayWithAddress>) => {
        setGateways(page.items);
        setTotalGateways(page.totalItems);
      },
    );

    // get auction and prices for each auction
    io.getArNSAuctions({ limit: 10 }).then(
      (page: PaginationResult<AoAuction>) => {
        setAuctions(page.items);
        setTotalAuctions(page.totalItems);
        page.items.forEach((auction: AoAuction) => {
          io.getArNSAuctionPrices({
            name: auction.name,
            type: 'lease',
            intervalMs: 1000 * 60 * 60 * 24, // 1 day
          }).then((price: AoAuctionPriceData) => {
            const arrayOfPrices = Object.entries(price.prices)
              .sort(([timestampA], [timestampB]) => +timestampA - +timestampB)
              .map(([timestamp, price]) => ({
                timestamp: new Date(+timestamp).toLocaleString('en-US', {
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                }),
                price: price / 10 ** 6,
              }));
            const auctionWithPrices = {
              ...auction,
              prices: arrayOfPrices,
              currentPrice: price.currentPrice / 10 ** 6,
            };
            setSelectedAuction(auctionWithPrices);
          });
        });
      },
    );
  }, []);

  return (
    <div className="App" style={{ padding: '50px', textAlign: 'center' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          marginBottom: '30px',
          alignItems: 'center',
        }}
      >
        <div>
          <h3>ArNS Names</h3>
          <div>
            <strong>Total Names:</strong> {totalNames}
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              justifyContent: 'center',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #ccc' }}>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Name</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>
                    Process
                  </th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Type</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Expiry</th>
                </tr>
              </thead>
              <tbody>
                {names.map((record) => (
                  <tr
                    key={record.name}
                    style={{ borderBottom: '1px solid #eee' }}
                  >
                    <td style={{ padding: '10px' }}>{record.name}</td>
                    <td style={{ padding: '10px' }}>
                      {record.processId.slice(0, 8)}...
                    </td>
                    <td style={{ padding: '10px' }}>{record.type}</td>
                    <td style={{ padding: '10px' }}>
                      {record.type === 'lease' && record.endTimestamp
                        ? new Date(record.endTimestamp).toLocaleDateString()
                        : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3>Active Gateways</h3>
          <div>
            <strong>Total Gateways:</strong> {totalGateways}
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              justifyContent: 'center',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #ccc' }}>
                  <th style={{ padding: '10px', textAlign: 'left' }}>
                    Address
                  </th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Status</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>
                    Stake (IO)
                  </th>
                </tr>
              </thead>
              <tbody>
                {gateways.map((gateway) => (
                  <tr
                    key={gateway.gatewayAddress}
                    style={{ borderBottom: '1px solid #eee' }}
                  >
                    <td style={{ padding: '10px' }}>
                      {gateway.gatewayAddress.slice(0, 8)}...
                    </td>
                    <td style={{ padding: '10px' }}>{gateway.status}</td>
                    <td style={{ padding: '10px' }}>
                      {gateway.operatorStake / 10 ** 6}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h3>Active Auctions</h3>
          <div>
            <strong>Total Auctions:</strong> {totalAuctions}
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              justifyContent: 'center',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #ccc' }}>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Name</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Ends</th>
                </tr>
              </thead>
              <tbody>
                {auctions.map((auction) => (
                  <tr
                    key={auction.name}
                    style={{ borderBottom: '1px solid #eee' }}
                  >
                    <td style={{ padding: '10px' }}>{auction.name}</td>
                    <td style={{ padding: '10px' }}>
                      {new Date(auction.endTimestamp).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selectedAuction && (
            <div style={{ margin: '0 auto' }}>
              <ResponsiveContainer width="50%" height={500}>
                <LineChart
                  data={selectedAuction.prices}
                  title={`Auction Prices for ${auctions[0].name}`}
                >
                  <XAxis dataKey="timestamp" tick={{ fontSize: 12 }}>
                    <Label value="Date" offset={-5} position="insideBottom" />
                  </XAxis>
                  <YAxis dataKey="price" tick={{ fontSize: 12 }}>
                    <Label value="Price" offset={10} position="top" />
                  </YAxis>
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="#222222"
                    strokeWidth={1}
                    dot={false}
                  >
                    <Label value="Price" offset={10} position="top" />
                  </Line>
                  <ReferenceLine
                    y={
                      selectedAuction.prices[selectedAuction.prices.length - 1]
                        .price
                    }
                    label={`Floor Price: ${selectedAuction.prices[selectedAuction.prices.length - 1].price}`}
                    stroke="red"
                    strokeDasharray="3 3"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
