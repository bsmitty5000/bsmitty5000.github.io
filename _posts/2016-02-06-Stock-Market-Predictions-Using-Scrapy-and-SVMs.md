---
layout: post
title: "Using the news to predict the Stock Market"
date: 2016-02-06
description: SVM, Machine Learning, Stock Market, Scrapy, Python
comments: True
category: ml
---
## overview
Using the [Scrapy package](http://doc.scrapy.org/en/latest/intro/tutorial.html) in Python I collected news article content from [Bloomberg Business Archive](http://www.businessweek.com/archive/news.html) for the year 2014. Using the content from the articles and historical S & P 500 data, I tried to train scikit-learn's [SVM algorithm](http://scikit-learn.org/stable/modules/svm.html) to predict whether or not the stock market would increase on a particular day. 

My inspiration came from a combination of this [blog post](http://francescopochetti.com/scrapying-around-web/), by Francesco Pochetti, and the idea of using SVMs to classify email as spam or ham. But mainly, since I'm new to Machine Learning in general, I wanted to do something that helped get my feet wet with web scraping and basic ML algorithms. 

The end results were about what you'd expect for something this basic, i.e. if you use a coin to predict if the market will go up each day, there's a 50% chance of being correct, and this project was barely able to compete with that coin. But like I said, I didn't do it to find an easy way to retirement, so I'll try my best to show what I did below.

[Link to repo page] (https://github.com/bsmitty5000/market-predictor)

## getting data using Scrapy
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

## using scikit-learn's SVM
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

Near the top of the script I also run a few lines to read in the S&P data I downloaded from Yahoo finance. It's just a csv file, so I was able to use the following line. I got this method from Udacity's Machine Learning for Trading course (I had to manually drop Dec 24th, since apparently the market was open Christmas Eve, but there was no corresponding data from Bloomberg):
                
    market_df = pd.read_csv('sp_500_2014.csv', index_col="Date",
                            parse_dates=True, usecols=['Date','Open','Close'],
                            na_values=['nan'])

    market_df = market_df.drop(pd.to_datetime('2014-12-24'))
    
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

The next important step is to combine the data for each day into a single row. The json has elements for each article, and I wanted a DataFrame that had data for each day. The code below is how I accomplished this. Basically, I made a new DataFrame and looped through the keyword_df and would either create a new row if that date hadn't been seen before, or a concatenated the keywords to the existing row for that day. Of note is the data_set DataFrame is built using the market_df, so that only days that I have market data will get populated. This ensures that the keyword data and the market data are matched:

        data_set = pd.DataFrame(index=market_df.index, columns=['keywords'])
        
        for i, row in keyword_df.iterrows():
            
            if keyword_df.loc[i, 'date'] in data_set.index:
                if pd.isnull(data_set.loc[keyword_df.loc[i, 'date']]).any():
                    data_set.loc[keyword_df.loc[i, 'date'], 'keywords'] = keyword_df.loc[i, 'keywords']
                else:
                    data_set.loc[keyword_df.loc[i, 'date'], 'keywords'] += keyword_df.loc[i, 'keywords']
                    
My next step was creating the feature set, i.e. a DataFrame with dimensions of the # of trading days by the number of words I'm going to look for (50 in this case). The columns will line up with the features_dict from above which contains the 50 words being used to search for. The code loops through the data_set DataFrame, containing the scraped keywords, and marks a one in the appropriate column in the feature set DataFrame if that particular word is found:

    feature_df = pd.DataFrame(index=data_set.index, columns=[range(50)])
    feature_df = feature_df.fillna(0)
    
    for i, row in data_set.iterrows():
        word_list = row.loc['keywords'].strip().split(',')
        for word in word_list:
            if word in features:
                feature_df.loc[i, features_dict[word]] = 1;
                
In the spirit of the spam classifiers, I simplified down the market data to a binary value, where 1 indicates a day the market closed higher than opening, and 0 otherwise:

    output_df = pd.DataFrame(index=data_set.index, columns=['rising'])
    for i, row in market_df.iterrows():
        if row['Close'] > row['Open']:
            output_df.loc[i, 'rising'] = 1
        else:
            output_df.loc[i, 'rising'] = 0
            
I decided to use a training, validation, and test set. The code below is how I randomized the selection process and created the six sets of data:

    features_train = feature_df.sample(n = 150)
    train_ind = features_train.index
    
    helper_df = feature_df.drop(train_ind)
    features_validate = helper_df.sample(n = 50)
    validate_ind = features_validate.index
    
    features_test = helper_df.drop(validate_ind)
    test_ind = features_test.index
    
    label_train = output_df.ix[train_ind]
    label_validate = output_df.ix[validate_ind]
    label_test = output_df.ix[test_ind]
    
The SVM algorithm from scikit-learn requires specific data structures to efficiently run. Below is the code I used to transform the DataFrames into arrays and lists:

    features_train = features_train.as_matrix()
    features_test = features_test.as_matrix()
    features_validate = features_validate.as_matrix()
    
    label_train = list(label_train.values.flatten())
    label_test = list(label_test.values.flatten())
    label_validate = list(label_validate.values.flatten())
    
I used the validation set to try and find the best value for the C parameter. I manually setup a list that containined the values I wanted to run the SVM with, looped through those using the training data and testing on the validation set, then finally ran the SVM using the best value for C and the test data set:

    C_values= [ 0.001, 0.01, 0.1, 1, 10, 100, 1000, 10000]
    
    print "Trying SVM rbf now"
    best_accuracy = 0
    
    for curr_C in C_values:
                    
        clf = svm.SVC(kernel = 'rbf', C = curr_C)
        clf.fit(features_train, label_train)
        
        pred = clf.predict(features_validate)
        curr_accuracy = accuracy_score(label_validate, pred)
        
        print "C = %f; accuracy: %f" %  (curr_C, curr_accuracy)
              
        if best_accuracy < curr_accuracy:
            best_accuracy = curr_accuracy
            best_C = curr_C
            
    print "Best C = %f; Best Accuracy = %f" % (best_C, best_accuracy)
    
    '''
    testing on test data
    '''
    clf = svm.SVC(kernel = 'rbf', C = best_C)
    clf.fit(features_train, label_train)
    
    pred = clf.predict(features_test)
    accuracy = accuracy_score(label_test, pred)
    
    print "Final test accuracy: %f" %  (accuracy)

## ending thoughts
This experience was very informative. It took me a very long time to do basic stuff because of my inexperience with Python. For example, building the training/validation/test sets- I wasn't away of the drop function for DataFrames, and so at one point I tried working with one set of randomly generated values for the training set, and super complicated for loops that were supposed to drop/add the right rows to build the test and validation sets.

Like I mentioned above though, getting my hands dirty with Scrapy, scikit-learn, and Python in general, was the only successful outcome for this project. If you were hoping to find a billion dollar trading scheme, stick with coin flipping.

Thanks for reading! I would really appreciate any feedback and don't hesistate to contact me with any questions.
