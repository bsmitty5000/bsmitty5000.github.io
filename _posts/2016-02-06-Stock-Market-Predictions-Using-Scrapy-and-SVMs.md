---
layout: post
title: "Using the news to predict the Stock Market"
date: 2016-02-06
description: SVM, Machine Learning, Stock Market
comments: True
category: ml
---
## overview
Using the [Scrapy package](http://doc.scrapy.org/en/latest/intro/tutorial.html) in Python I collected news article content from [Bloomberg Business Archive](http://www.businessweek.com/archive/news.html) for the year 2014. Using the content from the articles and historical S & P 500 data, I tried to train scikit-learn's [SVM algorithm](http://scikit-learn.org/stable/modules/svm.html) to predict whether or not the stock market would increase on a particular day. 

My inspiration came from a combination of this [blog post](http://francescopochetti.com/scrapying-around-web/), by Francesco Pochetti, and the idea of using SVMs to classify email as spam or ham. But mainly, since I'm new to Machine Learning in general, I wanted to do something that helped get my feet wet with web scraping and basic ML algorithms. 

The end results were about what you'd expect for something this basic, i.e. if you use a coin to predict if the market will go up each day, there's a 50% chance of being correct, and this project was barely able to compete with that coin. But like I said, I didn't do it to find an easy way to retirement, so I'll try my best to show what I did below.

## Getting data using Scrapy
Francesco's post does a good job of describing how to build a web scraper using Scrapy. I also highly recommend going through the tutorial on the Scrapy site. 

I built my spider using the built in CrawlSpider type. Since I knew I only wanted to look at months in the year 2014, I was able to define a rule, see below, that made that part very easy.

  rules = (Rule(LinkExtractor(allow=('www\.businessweek\.com\/archive\/2014-\d\d\/news\.html')),
          callback='parse_day_tabs'),)

A quick note on the Bloomerberg archive structure: Starting from the Bloomberg link above, you can get to each month for a particular year all the way back to 1991. I'm not 100% why, possibly because they don't start archiving for a set time, but there's only data starting at January 2015 and back. The links on the monthly page will take you to the actual articles. You can't see all of one particular month's articles on the first page though, there's a tab near the top for each week, and you must click through each of those tabs to get the full months list of articles.

The CrawlSpider and the rule defined above takes care of gathering all twelve links for 2014. The callback function used in the rule above is the next level down, which will cycle through all the tabs for a particular month, see the code below (unfortunate naming here, would have made more sense to call it parse_weekly_tabs or something).
    
    def parse_day_tabs(self, response):
        for href in response.xpath('//ul[@class="weeks"]/li/a/@href'):
            url = href.extract()
            yield scrapy.Request(url, callback=self.parse_month_links)


## Using Scikit Learn's SVM
I used Scikit Learn's built-in SVM.
