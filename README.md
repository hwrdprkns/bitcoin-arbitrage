## Bitcoin Arbitrage

This is a simple script that finds interesting arbitrage opportunities for cryptocurrencies. At the moment there are only two exchanges with relatively different volumes ([Kraken](https://kraken.com) and [BitStamp](https://bitstamp/com))

### What is arbitrage

In order to buy/sell cryptocurrencies we need to be in a market. This market is called [Exchange](https://en.wikipedia.org/wiki/Digital_currency_exchange). We assume that there are different markets that let people trade the same digital assets. Due to market inefficiencies and difference of trading volume between each other, the price for the same digital asset can be different from an exchange to another. This is true in traditional markets (like New York Stock Exchang vs London Stock Exchang, others...), but is as well in crypto currencies markets (like Kraken and Bitstamp, others...).

Now I am Bob and I want to buy 1 BTC in the exchange A, the price in there is 1BTC=3672$. I am Bob and I can also buy 1 BTC on exchange B, the price in there is 1BTC=3630$. Now what I can do is buying 1 BTC at exchange B and sell the same 1BTC at exchange A. This is called arbitrage.

> Arbitrage is the simultaneous purchase and sale of an asset to profit from a difference in the price. It is a trade that profits by exploiting the price differences of identical or similar financial instruments on different markets or in different forms. Arbitrage exists as a result of market inefficiencies. -- [Investopedia](http://www.investopedia.com/terms/a/arbitrage.asp#ixzz4tS44jciY) 

### What this script does

This script pulles the exchange rates of BTCEUR (or a list of currencies you want) every 5 minutes and whenever it detects a spread of at least 2% between the two rates it alerts you with a direct message. (it will be able to buy soon)

### Assumptions and constraints
- You need to have two verified accounts in both (or how many exchange you want to do arbitrage on)
- Both accounts (or more) must have funds (BTC, EUR or whatever assets you want to arbitrage on)
- The spread can change quickly, but the transactions can get approved with dealy which would cause you potential losses

### Setup the bot

In order to get started you just have to:

Download

```sh
git clone github.com/0x13a/bitcoin-arbitrage
```

Install the project
```sh
cd bitcoin-arbitrage
npm install
```

Setup the twitter api keys (get the api keys from [here](https://apps.twitter.com/)) and the assets pairs you want to watch
```sh
PAIRS=BTCEUR,ETHEUR
TWITTER_ACCESS_TOKEN=whatever
TWITTER_ACCESS_TOKEN_SECRET=whatever
TWITTER_CONSUMER_KEY=whatever
TWITTER_CONSUMER_SECRET=whatever
TWITTER_USERNAME=0x13a
```

Setup the cronjob
```sh
crontab -e
```

Set every 5 minutes
```sh
*/5 * * * * /usr/local/bin/node /home/steve/example/script.js
```