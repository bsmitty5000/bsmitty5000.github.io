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

Before describing the spider, a quick note on the Bloomerberg archive structure: Starting from the Bloomberg link above, you can get to each month for a particular year all the way back to 1991. The links on each month's page will take you to the actual articles. You can't see all of one particular month's articles on the first page though, there's a tab near the top for each week, and you must click through each of those tabs to get the full months list of articles.

I used the built in CrawlSpider type. Since I knew I only wanted to look at the year 2014, I was able to define a rule, see below, that made finding those particular links easy:

    rules = (Rule(LinkExtractor(allow=('www\.businessweek\.com\/archive\/2014-\d\d\/news\.html')), callback='parse_day_tabs'),)

The CrawlSpider, with the rule defined above, takes care of gathering all twelve links for 2014. The callback function used in the rule is the next level down, and gathers up the link associated with each tab (looking at the comments in the actual code I guess I was a bit confused when I wrote it, but there's a tab for each week, and the title for the tabs are the date range for that week):
    
    def parse_day_tabs(self, response):
        for href in response.xpath('//ul[@class="weeks"]/li/a/@href'):
            url = href.extract()
            yield scrapy.Request(url, callback=self.parse_month_links)

The callback used in the parser above is then gathering up the article links on the current tab's page (poor naming convention here- I think this parser was made before I realized I had to go through each of the tabs, so the name really should be parse_article_links or something. If I remember I'll change in the code. If you're reading this that means I probably forgot):

    def parse_month_links(self, response):
        for href in response.xpath('//ul[@class = "archive"]/li/h1/a/@href'):
            url = href.extract()
            yield scrapy.Request(url, callback=self.parse_articles)
            
The callback used in this last parser is the actual workhorse. The spider is finally sitting on an actual article page and grabs all the data. It stores it in an item class that's defined in the director above the spiders:

    def parse_articles(self, response):
        item = BusweekItem();
        item['date'] = response.xpath('//meta[@name = "pub_date"]/@content').extract()
        item['body'] = response.xpath('//div[@id = "article_body"]/p/text()').extract()
        item['keywords'] = response.xpath('//meta[@name = "keywords"]/@content').extract()
        item['title'] = response.xpath('//title/text()').extract()
        yield item

The final yield here was somehow, and this part I'm not so clear on, used in combination with the way I ran the spider. The command was taken directly from Francesco and the Scrapy tutorial:

    scrapy crawl dmoz -o items.json
        
I found it incredibly useful to use Firefox's Firebug to find the necessary xpath code (and a lot of help from Francesco).

So this was a quick walkthrough of the code. The actual directory structure and project setup is all covered in the Scrapy tutorial quite nicely. One thing that helped me a lot, since I'm completely new to xpath, web crawling, all that stuff, was the built in Scrapy shell (instructions are on the linked Scrapy tutorial above). You can quickly scrape a page and try out different xpaths to see which will work.

## Using Scikit Learn's SVM
Note: Below I'll describe the latest version of this project. Originally I used the actual content of the articles to feed into the SVM but switched to using the keywords.

So after running the spider I had about 27 MB of text data. Francesco was again my inspiration in how to clean the data. I'm also quite new to Python, so it was quite a struggle for me to get the data into the correct data structures, e.g. it took me a while to understand Francesco's 'unlist(element)' function. In any case, the code below reads the data into a DataFrame, cleans up the date, drops any possible duplicate rows, the title and body columns, and also any rows with blank keywords:

        def unlist(element):
            return ''.join(element)
        
        def read_scraped_jason(filename):
            df = pd.read_json(filename)
            
            for column in df.columns:
                df[column] = df[column].apply(unlist)
            # gets only first 10 characters of date: year/month/day
            df['date'] = df['date'].apply(lambda x: x[:10])
            df['date'] = pd.to_datetime(df['date'])
            
            # if any removes duplicate posts
            df = df.drop_duplicates(subset = ['keywords'])
            # sorts dataframe by post date
            df = df.sort_values(by='date')
         
            df = df.drop('body', 1)
            df = df.drop('title', 1)
            
            df['keywords'].replace('', np.nan, inplace=True)
            df = df.dropna()
            
            return df

Near the top of the script I also run a few lines to read in the S&P data I downloaded from Yahoo finance. It's just a csv file, so I was able to use the following line. I got this method from Udacity's Machine Learning for Trading course:
                
    market_df = pd.read_csv('sp_500_2014.csv', index_col="Date",
                            parse_dates=True, usecols=['Date','Open','Close'],
                            na_values=['nan'])

The process of deciding which words to look for when training and testing the data in the SVM I got from Andrew Ng's Coursera course, in the SVM assignment. Basically, all the keywords are tallied and the top 50 are chosen to be the feature set. Here's how I did that part:

    word_dict = dict()
    for index, row in keyword_df.iterrows():
        word_list = row.loc['keywords'].strip().split(',')
        for word in word_list:
            if not unicode.isdigit(word):
                if word_dict.has_key(word):
                    word_dict[word] = word_dict[word] + 1;
                else:
                    word_dict[word] = 1;
                    
    sorted_words = sorted(word_dict, key=word_dict.get, reverse=True)
    features = sorted_words[0:50]
    features_dict = {}
    for i in range(len(features)):
        features_dict[features[i]] = i;
        
Where keyword_df is the dataframe containing the scraped data. 

I think at this point if you have a decent amount of Python experience you might be cringing at my implemenation. If so, I would really appreciate any tips/advice. The logic is not difficult, but coming from a C background it's sometimes hard for me to really take advantage of Python.

The next important step is to combine the data for each day into a single row. The json has elements for each article, and I wanted a DataFrame that had data for each day. The code below is how I accomplished this. Basically, I made a new DataFrame and looped through the keyword_df and would either create a new row if that date hadn't been seen before, or a concatenated the keywords to the existing row for that day:

        data_set = pd.DataFrame(index=market_df.index, columns=['keywords'])
        
        for i, row in keyword_df.iterrows():
            
            if keyword_df.loc[i, 'date'] in data_set.index:
                if pd.isnull(data_set.loc[keyword_df.loc[i, 'date']]).any():
                    data_set.loc[keyword_df.loc[i, 'date'], 'keywords'] = keyword_df.loc[i, 'keywords']
                else:
                    data_set.loc[keyword_df.loc[i, 'date'], 'keywords'] += keyword_df.loc[i, 'keywords']
                    
So at this point, I have the data set containing days
