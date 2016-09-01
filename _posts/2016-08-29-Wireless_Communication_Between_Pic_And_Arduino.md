---
layout: post
title: "wireless communication between PIC and Arduino"
date: 2016-08-29
description: Testing out the si4432 with a dsPIC33f and Arduino 32u4 Mini LV
comments: True
category: mbed
---
## the si4432

I found [this](http://www.ebay.com/itm/SI4432-470MHz-1000m-Wireless-Module-470M-433mhz-Wireless-Communication-Module-/200932667345?hash=item2ec8852fd1:g:-ccAAOSw7ehXSPMY)transceiver on ebay and decided to try it out. I eventually want to use it for some sort of RC car, nothing too powerful, so I'm not worrying about the frequency range too much. After fishing around on the internet for a while looking for other projects, tutorials, etc. I eventually stumbled on the actual product [page](http://www.silabs.com/products/wireless/EZRadioPRO/Pages/Si44303132.aspx) which contained an amazing amount of information, so this is the best place to start if you're just getting started. Particularly this [guide](http://www.silabs.com/Support%20Documents/TechnicalDocs/AN415.pdf) and this [spreadsheet](http://www.silabs.com/Support%20Documents/Software/Si443x-Register-Settings_RevB1.xls) that calculates register values based on the specific settings chosen.

## project overview

To get a taste of how to work with the si4432 I decided to get an Arduino and the dsPIC33f talking to each other using a pair of the transceivers. The [Arduino](https://www.pololu.com/product/3103) is an A* 32U4 Mini LV from Pololu I got during a Black Friday sale or something. I'm not super familiar with the different Arduino flavors, but from looking around I guess this resembles a Leonardo and uses an ATmega32U4. It runs at 5V off USB power, which is something I had to deal with since the si4432 runs off 3.3V, but more on that later. I should note that there is an Arduino library already developed for this chipset, I think the si4432 is an updated product but essentially the same. I don't use that library but it can be found [here](http://www.airspayce.com/mikem/arduino/RF22/).
The PIC is the [dsPIC33f](http://www.microchip.com/wwwproducts/en/dsPIC33FJ64MC802) running on the Microstick that I've used in most of my other posts. This project dives into setting up the SPI module which, for the PIC, is a bit more involved than simply including the SPI.h library like the Arduino.

## hardware connections

![connections]({{site.url}}assets/si4432_test/si4432_test.JPG)


