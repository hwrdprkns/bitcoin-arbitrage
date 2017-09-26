require('dotenv').config();

const Bitstamp = require('bitstamp');
const Kraken = require('kraken-api');
const Twitter = require('twit');
const {promisify, format} = require('util');

const bitstamp = new Bitstamp();
const kraken = new Kraken();
const asyncBitstampTicker = promisify(bitstamp.ticker);
const pairs = process.env.PAIRS.split(',');
const t = new Twitter({
    consumer_key:         process.env.TWITTER_CONSUMER_KEY,
    consumer_secret:      process.env.TWITTER_CONSUMER_SECRET,
    access_token:         process.env.TWITTER_ACCESS_TOKEN,
    access_token_secret:  process.env.TWITTER_ACCESS_TOKEN_SECRET,
    timeout_ms:           60*1000,
});

(async function() {
    for (let pair of pairs) {
        try {
            let spread = await calculateSpread(pair);
            if (spread < 2) {
                console.log(spread);
                continue;
            }
            // send message if spread is over 2%
            t.post('direct_messages/new', {text: format('today spread between kraken and bitstamp for assets pair: %s is %f!', pair, spread), screen_name: process.env.TWITTER_USERNAME}, function (err, data, response) {
                if (err) {
                    console.log('on no, impossible to send message!');
                    return;
                }
            });
        } catch (e) {
            console.log('error occurred while processing spread for ', pair);
            console.log(e);
            continue;
        }
    }
})();

// given a currency pair calculate the spread in the two exchanges
// returned in percentage points
async function calculateSpread(pair) {
    const krakenPromise = kraken.api('Ticker', { pair : formatToKrakenPair(pair) });
    const bitstampPromise = asyncBitstampTicker(pair);
    // Get Ticker Info
    const [krakenResponse, bitstampResponse] = await Promise.all([krakenPromise, bitstampPromise])
    const krakenPrice = krakenResponse['result'][formatToKrakenPair(pair)]['a'][0];
    const bitstampPrice = bitstampResponse['ask'];
    // get lower / higher price
    const {lower, higher} = minMax(krakenPrice, bitstampPrice);

    return (100 - ((lower / higher) * 100)).toFixed(2);
}

// kraken uses a special syntax for ticker pair
// this is horrible dont judge me
function formatToKrakenPair(pair) {
    let first = pair.substring(0, 3);
    let second = pair.substring(3);
    let krakenPair = '';
    if (isFiatCurrency(first)) {
        krakenPair += 'Z'+first;
    } else {
        krakenPair += 'X'+formatToKrakenXBT(first);
    }
    if (isFiatCurrency(second)) {
        krakenPair += 'Z'+second;
    } else {
        krakenPair += 'X'+formatToKrakenXBT(second);
    }

    return krakenPair;
}

// checks whether is a fiat currency
function isFiatCurrency(c) {
    if (['USD', 'EUR', 'JPY', 'GBP', 'CAD'].indexOf(c) === -1) {
        return false;
    }
    return true;
}

// kraken uses the currency code XBT instead of BTC for bitcoin
function formatToKrakenXBT(btc) {
    if (btc === 'BTC') {
        return 'XBT';
    }
    return btc;
}

// returns whether of the values are higher or lower
function minMax(a, b) {
    let lower = a;
    let higher = b;
    if (lower > b) {
        lower = b;
        higher = a;
    }
    return {lower, higher};
}
