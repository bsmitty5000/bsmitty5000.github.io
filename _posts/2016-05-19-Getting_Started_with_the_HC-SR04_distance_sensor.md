---
layout: post
title: "getting started with the hc-sr04 distance sensor"
date: 2016-05-19
description: Simple project interfacing a dsPIC33f and the hc-sr04 distance sensor
comments: True
category: mbed
---
## overview
Alright alright alright, back at it again. This time I'm trying to wrap my head around interfacing with this cool ultra-sonic distance sensor, model number HC-SR04. It's a pretty bulky looking thing, I mean relatively speaking, with two speaker like columns coming out of the board. But the concept is cool- after getting triggered it shoots out some sound pulses and waits for the echo to come back. You can measure the distance by timing how long the output pin stays high and using the speed of sound. 

Anyways, I'll just dive right in to how I got things working. Here's the [link](https://github.com/bsmitty5000/getting_started_with_hc-sr04) for the repo with all the PIC source files and python script.

By the way, I was excited to find these things on ebay for less than $2 each, and with the cool shipping options from China I was able to get six for around $10! So much better than other distance sensors you find from supply shops around the web.

## pic setup

So you should check out my previous post on UART communincation using the dsPIC33f. I'm using the same uc in this project too (I just love the [Microstick](http://www.microchip.com/DevelopmentTools/Listing.aspx?CatID=88d053fc-5616-4075-b4d4-6fb5ee8681d3) so much). You can find that post [here](http://bsmitty5000.github.io/mbed/2016/05/14/Communication-between-PIC-and-PC/) and it explains the UART setup and the Osc setup in more detail. The only change between that project and this are the pins I'm using here for the UART tx and rx.

### hc-sr04 input/output connections

The first thing you'll notice if you try this setup is the HC-SR04 board runs at 5V and the PIC runs at 3.3V. Luckily, this particular PIC has a handful of 5V tolerant pins on it which allowed me to avoid having to buy any logic shifters. That means the output pin on the PIC, connected to the input pin on the sensor, needs to be configured as open-drain with a pull-up resistor to 5V. The details can be found in the I/O Ports section of the datasheet, but it's actually quite simple. All you need to do is make the pin an output (TRISx register) and set the Open-Drain register (ODCx). Code found in init.c:

```c
//Using RP7 for trigger (output)
TRISBbits.TRISB7 = 0;
//configure for open-drain to allow 5V on pin
ODCBbits.ODCB7 = 1;
```

After the open-drain register has been set, assigning a '1' to the LATx register will put the pin in Hi-Z mode and the pull-up resistor do it's job and we'll get 5V on the pin. When it's assigned a '0', the pin will be grounded. Important to note, and I'm like 90% sure this is correct, when low the pin will be sinking (5V / Pull-up resistor value) amount of current. The only question is how much, if any, current is going into the input of the sensor. I chose a 10K resistor which comes out to about 500uA, well below the 5mA pin limit.

#### input capture
The input pin needs nothing special done in regards to the voltage difference, other than choosing a 5V tolerant pin. I decided to try out the Input Capture functionality to measure the amount of time the output of the sensor is high, rather than trying to poll or something. My previous post goes into a bit more detail about peripheral pin mapping, but for inputs it basically boils down to writing the pin number to the correct peripheral control register. Here's a snippet found in init.c:

```c
//Using RP6 as echo (input)
TRISBbits.TRISB6 = 1;
//Map IC1 to RP6
RPINR7bits.IC1R = 6;
```

Input Capture has its own section in the datasheet that goes over all the different configurations. For this project I needed to capture the rising and falling edge of the sensor's output pin. When capturing on both edges you're forced to deal with an interrupt on each capture. I'll explain the logic in main.c to account for this, but here's another snippet showing the configuration setup:

```c
//Capture events on rising & falling edge
IC1CONbits.ICM = 1;
```

I mapped Timer 2 to this Input Capture module. I setup Timer 2 to run on the interal instruction clock, which for this project is 40Mhz, and used a 1:8 prescaler. This gave a nice, round 5 ticks per microsecond, which made the math in main.c a bit nicer. Here's the Timer 2 setup:

```c
//Use internal Fcy (40 MHz)
T2CONbits.TCS = 0;

//1:8 prescaler
//5 counts for 1us
T2CONbits.TCKPS = 1;

//Turning it on
T2CONbits.TON = 1;
```

## interacting with the sensor

This sensor has some of the least professional [documentation](http://www.micropik.com/PDF/HCSR04.pdf) I've ever seen, but it was enough to get the point across. It's a simple enough sensor I suppose that not much is actually needed. It requires the input pin to be held at 5V for 10us to kick off a reading. After the input pin goes low, it sends out a few pulses and immediately sets the output pin high. The ouput pin remains high until the sensor recieves the bounce back from those pulses it sent out. So the output pin on the sensor is held high for the amount of time it takes for the sound waves to go there & back. 

Instead of just triggering the sensor as fast as possible, e.g. simply waiting for the output pin to go low then triggering again, I decided to use frames to separate out measurements. That way I'm getting a steady beat that's not based on how long the output pin is held high. That datasheet I linked mentioned something about a '60ms measurement cycle', so I chose to use a 60ms frame for each measurement. I used Timer 1 to control frame timing, which required getting interrupts setup for it. 

Here's the processing scheme starting at top of frame:
1. Clear the new_frame_start flag
   - new_frame_start flag is used later on to indicate when Timer 1 interrupt triggered and it's time to start a new frame
2. Clear the Timer 1 count register and start it up
3. Assert the trigger pin for about 10us using the Timer 1 count register
4. (Not part of the main loop) The output of the sensor should trigger two interrupts at rising and falling edges
5. Make sure both interrupts happened by reading the falling_edge_rcvd flag, then calculate the distance
   - Note: You can find example code doing this exact functionaility in the reference manual section for Input Capture
6. Send the distance value over UART

So technically this isn't exactly a 60ms frame, it's a bit longer because I'm waiting 60ms then calcuating and sending distance. But since nothing is dependent on this timing it's OK for now.

To account for the fact that an interrupt occurs on every edge in the Input Capture module, I made a few global variables to hold the Timer 2 count at rising and falling edges. I used rising_edge flag to determine which edge the interrupt is getting generated for. I'm making the, in my opinion, safe assumption that the sensor will be well behaved and no extraneous edges will be seen on it's output pin. The rising_edge flag is initialized to 1, meaning I'm expecting the first interrupt to be for the rising edge.


## python script
The python script in this project is quite simple, it reads the serial port for distance values and prints it out. you have to ctrl-c your way out of it once it starts reading from the PIC. Either the PIC or this python script can be started first- the program running on the PIC will sit and wait for the PC to send a byte over the serial line before it starts up the sensor, and the python script waits for user input before sending that byte. This way there's no chance of the python script starting first and timing out when it tries to read the serial port (I'm using Spyder for all my python work and it crashes occasionally when the serial.read() function times out).

## conclusion
This is a pretty simple project. It helped me get aquainted with Input Capture on the PIC side and let me play around with this cool sensor. It turns out to be pretty accurate, at least when I put a nice solid object in front of it. Eventually I'll try to get a few more connected at the same time to try and get a poor man's Lydar or something going. Thanks for reading!
