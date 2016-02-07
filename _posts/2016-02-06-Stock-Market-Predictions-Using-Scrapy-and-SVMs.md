---
layout: post
title: "Using the news to predict the Stock Market"
date: 2016-02-06
description: SVM, Machine Learning, Stock Market
comments: True
category: ml
---
## project purpose and overview
Currently I'm about 80% of the way through Andrew Ng's Intro to ML Coursera course. After completing the SVM and spam filtering assignment, I decided to try it out myself. 

I've had a passive interest in trying to use social media, news articles, etc. as a way to predict stock market trends for a while but never put it in action. While researching for previous work on the topic I ran across Francesco Pochetti's [post](http://francescopochetti.com/scrapying-around-web/) on trying to predict the market using sentiment analysis.
I liked this idea and used it as a starting point.
Francesco uses [Scrapy](http://scrapy.org/) to build a web scraper for gathering archived news articles from [Bloomerber](http://www.businessweek.com/archive/news.html). He then runs a sentiment analysis algorithm on the data to determine a general sentiment score. This is then used in his market prediction algorithm.
Instead of trying to run sentiment analysis on the news articles then using that output as a predictor for the market, I decided to train an SVM algorithm using the content of the articles and the actual market behavior. Just like a spam filter uses the content of emails to determine the spam/ham category, I used the content of the articles to determine a rising/falling day in the market.
The purpose of the project was to predict the stock market, but the purpose for actually starting the project was to try and learn how to do web scraping and how to use SVMs without the handholding the Coursera assignment gives. I knew the likelihood of stumbling upon a million dollar algorithm was zero, but it was fun nonetheless. So please don't try to use this as an investment tool, you'd be better off flipping a coin.
I built the web scraper using [Scrapy](http://scrapy.org/) and the SVM algorithm from [scikit-learn](http://scikit-learn.org/stable/modules/svm.html).
Below I'll try to describe how I built the web scraper and then how I trained and tested the SVM.

## Getting data using Scrapy
Francesco's post does a good job of describing how to build a web scraper using Scrapy. I also highly recommend going through the tutorial on the Scrapy site. 

In essence, you create a spider that crawls the website looking for objects you define, and once it finds those objects, can call functions that parse the data in those objects. 

Since I'm quite lazy, I wanted to build a web scraper that could use the starting URL I linked above for Bloomberg's news archive and do everything itself, e.g. grabbing all the months for a particular year, clicking through each tab in the month so that all articles are read, and then scraping the actual article data. This meant defining several parser functions and building a special type of spider called a CrawlSpider.

> A quick note on the Bloomerberg archive structure. Starting from the URL above, you can get to each month for a particular year all the way back to 1991. I'm not 100% why, possibly because they don't start archiving for a set time, but there's only data starting at January 2015 and back. The links on the monthly page will take you to the actual articles. But you cannot see all of that month's articles on one page. There's a tab near the top for each week, and you must click through each of those tabs to get the full months list of articles.

The reason I used a CrawlSpider was so I could define a rule for the links I wanted to explore from the starting URL. Since the archive starts January 2015, I decided I only wanted to look at articles from 2014. This was to keep the data set fairly small, since like I mentioned above, I wasn't intent on trying to retire off this thing. The code for the CrawlSpider is below, and you can see the rule defined. It uses regex to find all the links for 2014. Each link will take you to a month

## Using Scikit Learn's SVM
I used Scikit Learn's built-in SVM.
