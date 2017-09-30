

const Bitstamp = require('bitstamp');
const Kraken = require('kraken-api');
const SNS = require('aws-sdk/clients/sns');
const SSM = require('aws-sdk/clients/ssm');
const Winston = require('winston');

const logger = Winston.createLogger({
  transports: [new Winston.transports.Console()],
});

let KrakenClient = null;
let BitstampClient = null;

class OrderSubmissionError extends Error {
  constructor(...args) {
    super(...args);
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports.watch = async (event, context, callback) => {
  logger.info(event);
  await loadConfigs();
  callback(null, await tradePairs(event));
};

export const tradePairs = async (event) => {
  const {
    amount, pair, spreadThreshold, TargetArn,
  } = event;
  const asset = pair.base + pair.quote;

  const krakenPrice = getKrakenPrice(asset);
  const bitstampPrice = getBitstampPrice(asset);
  const spread = calculateSpread(krakenPrice, bitstampPrice);

  logger.info({
    message: 'Pulled Ticker info',
    asset,
    krakenPrice,
    bitstampPrice,
    spread,
    spreadThreshold,
  });
  if (spread < spreadThreshold) {
    return { message: 'Spred below threshold', spread, spreadThreshold };
  }

  let [buyExchange, sellExchange] = ['bitstamp', 'kraken'];
  let [buyMethod, sellMethod] = [placeBitsampOrder, placeKrakenOrder];
  let tradeVolume = (amount / bitstampPrice).toFixed(6);
  if (krakenPrice < bitstampPrice) {
    [buyExchange, sellExchange] = ['kraken', 'bitstamp'];
    [buyMethod, sellMethod] = [placeKrakenOrder, placeBitsampOrder];
    tradeVolume = (amount / krakenPrice).toFixed(6);
  }

  const coerceOrderId = resp => resp.id || resp.txid;
  const buyResponse = buyMethod(asset, 'buy', tradeVolume);
  const buyOrderId = coerceOrderId(buyResponse);
  if (!buyOrderId) {
    throw new OrderSubmissionError({ buyResponse, buyExchange });
  }

  const sellResponse = sellMethod(asset, 'sell', tradeVolume);
  const sellOrderId = coerceOrderId(sellResponse);
  if (!sellOrderId) {
    throw new OrderSubmissionError({ sellResponse, sellExchange });
  }

  const message = `successfully bought ${amount} and sold ${tradeVolume} of ${pair}`;
  logger.info(message);
  return new SNS().publish({ MessageStructure: 'string', Message: message, TargetArn }).promise();
};

export const loadConfigs = async () => {
  const keyspace = '/prod/bitcoin-arbitrage';

  if (!BitstampClient) {
    const bitstampParams = await new SSM().getParameter({ Name: `${keyspace}/bitstamp_keys` })
      .promise().then(data => data.Parameter.Value.split(','));
    BitstampClient = new Bitstamp(...bitstampParams);
  }

  if (!KrakenClient) {
    const krakenParams = await new SSM().getParameter({ Name: `${keyspace}/kraken_keys` })
      .promise().then(data => data.Parameter.Value.split(','));
    KrakenClient = new Kraken(...krakenParams);
  }
};

export const placeBitsampOrder = (pair, side, volume) => new Promise((resolve, reject) => {
  const handler = (err, resp) => {
    if (err) { reject(err); }

    logger.info(resp);
    resolve(resp);
  };

  if (side === 'buy') {
    return BitstampClient.buyMarket(pair.toLowerCase(), volume, handler);
  } else if (side === 'sell') {
    return BitstampClient.sellMarket(pair.toLowerCase(), volume, handler);
  }

  return reject(new OrderSubmissionError({ side }));
});

export const getBitstampPrice = async pair => new Promise((resolve, reject) => BitstampClient.ticker(pair.toLowerCase(), (err, resp) => {
  if (err) { reject(err); }

  logger.info(resp);
  return resolve(resp.ask);
}));

export const placeKrakenOrder = async (pair, side, volume) => {
  const symbol = formatToKrakenPair(pair);
  const params = {
    pair: symbol, ordertype: 'market', type: side, volume,
  };

  const resp = await KrakenClient.api('AddOrder', params).result;
  logger.info(resp);
  return resp;
};

export const getKrakenPrice = async (pair) => {
  const symbol = formatToKrakenPair(pair);
  const resp = await KrakenClient.api('Ticker', { pair: symbol });
  logger.info(resp);
  return resp.result[symbol].a[0];
};

// kraken uses a special syntax for ticker pair
export const formatToKrakenPair = (pair) => {
  const krakenSymbols = pair.slice(3).map((symbol) => {
    const fiatCurrencies = ['USD', 'EUR', 'JPY', 'GBP', 'CAD'];
    switch (symbol) {
      case fiatCurrencies.includes(symbol): return `Z${symbol}`;
      case 'BTC': return 'XXBT';
      default: return `X${symbol}`;
    }
  });

  return krakenSymbols.join('');
};

// returned in percentage points
export const calculateSpread = (krakenPrice, bitstampPrice) => {
  const [lower, higher] = [krakenPrice, bitstampPrice].sort();
  return (100 - ((lower / higher) * 100)).toFixed(2);
};
