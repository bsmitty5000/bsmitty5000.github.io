---
layout: post
title: "diy IR distance sensor"
date: 2016-05-19
description: Using an IR LED and IR photodiode to make a cheaper IR distance sensor
comments: True
category: mbed
---
## the IR portion
My last [post](http://bsmitty5000.github.io/mbed/2016/05/19/Getting_Started_with_the_HC-SR04_distance_sensor/) dealt with an ultrasonic distance sensor. I saw one of those on ebay for cheap and jumped at it. Turns out they don't seem to work all that great with sharp objects that are at funny angles to the sensor (at least I couldn't get it to work reliably). So I looked into IR sensors and found they're about 3x more [expensive](http://www.ebay.com/itm/GP2Y0A21YK0F-Sharp-IR-Analog-Distance-Sensor-Distance-10-80CM-Cable-For-Arduino-/221894048614?hash=item33a9ea7b66:g:o94AAOSwiLdWAnGr), so I looked into making my own. I landed on the following components:

* [IR photodiode](http://www.vishay.com/docs/81509/bpv22nf.pdf) : $1.11 @ digikey 
* [IR led](http://www.osram-os.com/Graphics/XPic7/00101979_0.pdf) : $0.59 @ digikey
* [opamp](http://www.ti.com/lit/ds/symlink/ne5532.pdf) : $0.94 @ digikey

So a bit more than half the price of buying the integrated IR distance sensor. And when you factor in the need for type of case to contain the led and photodiode, it probably would have been better to get the premade IR sensor. But I suppose that's less fun.

## IR detection circuit
I found [this](http://www.analog.com/media/en/technical-documentation/technical-articles/Optimizing-Precision-Photodiode-Sensor-Circuit-Design-MS-2624.pdf) Analog Devices post extremely helpful when setting up my circuit. Diagram below:

![connections]({{site.url}}assets/diy_IR_distance_sensor_hardware.JPG)

This figure is a bit out of date, since the resistance in the IR led circuit, the brown diode, is now about 50 ohm instead of 680 ohm (at the time I hadn't tested the whole circuit, and found later that the photodiode responds much better with a brighter led....duh). The IR led has about a 1.3V drop when forward biased so it's getting at 75mA with the current, 50 ohm, resistor.

As in previous posts I'm using a wallwart as the power source, in purple, for the circuit.

The opamp, in blue, is setup as a current-to-voltage converter (transimpedance): the current through the photodiode, in orange, is directed through the 1M ohm resistor. The output voltage is the photodiode's short circuit current, since the opamp keeps the voltage across it at 0V, multiplied by the inverting resistor. I landed on 1M ohm after some guess & checking and now the range seems to be about 1.3V or so up to about 4.3V.

The PIC's (PIC is in green) ADC input pins can't handle more than 3.3V so I setup a simple voltage divider to cut down the output of the opamp. Even though I mentioned this circuit doesn't output more than about 4.3V, I setup the voltage divider using 5V as its max output just to be safe. With the resistors I had on hand the closest I could get is a ratio of 0.656, which comes out to about 3.28V at the ADC pin if the opamp's output hits 5V.

This particular PIC wants about 200 ohms as max input resistance for the ADC module. Since I didn't have any resistors that low that I could make a decent voltage divider with I added the 0.1uF cap across the divider's output. This is suggested by the [reference manual](http://ww1.microchip.com/downloads/en/DeviceDoc/70183D.pdf) near the bottom. It might be overkill since I'm not sampling particularly quickly and I'm not using the full 12-bit range.

It's important to note that the negative pin of the wallwart is tied to the AVss pin on the PIC.

To communicate with the computer I'm using the same FT232R breakout board, in red, as seen in previous posts.


Actual setup, with divider to block the radiant LED light from the photodiode:

![actual]({{site.url}}assets/diy_IR_distance_sensor_actual_hardware.JPG)

## execution summary
My goal with this little project was to graph the output of the sensor to compare to other analog IR distance sensors, like [this](https://www.pololu.com/product/136/pictures) sensor on Pololu (you can see the output graph in the middle of the page), to make sure what I have seems reasonable. So to do this, the python program, running on the PC, asks the user for the current distance from the sensor the object is. It then sends a flag to the PIC that indicates it's time to sample the ADC pin, the PIC sends the raw ADC value back to the PC, and the python script records the distance and ADC value. This loops until the user enters the quit button and the python script graphs the values.

### main loop on the PIC
This is a super simple loop that waits for a received char on the UART, samples the ADC, then sends that raw value back over the UART. I decided to skip any type of conversion to voltage since it's all linear anyways, ie the graphs would look the exact same just different y-axis value. In fact, for any application that I plan on using this for raw ADC values will probably be sufficient.

### python program on PC
This is also a super simple script. It just prompts the user for the current distance and then sends a random char to the PIC, waits for the response, then prompts the user for the next input. It stores the distance and the received value from the PIC in two arrays. When the user enters a 'q', the program exits the loop and graphs the values, ADC value vs. distance.

## project source code links
There's some UART communication between the PIC and the python script using the FT232R breakout board and code from [this](http://bsmitty5000.github.io/mbed/2016/05/14/Communication-between-PIC-and-PC/) project that's reused here, with some pin differences. If anything doesn't make sense refer to that project.

Here's the [link](https://github.com/bsmitty5000/diy_IR_distance_sensor) for the repo with all the PIC source files and python script for this project.

## code overview

### init.c

**_InitUART1_**

Exactly the same as [here](http://bsmitty5000.github.io/mbed/2016/05/19/Getting_Started_with_the_HC-SR04_distance_sensor/).

**_InitClock_**

Exactly the same as [here](http://bsmitty5000.github.io/mbed/2016/05/19/Getting_Started_with_the_HC-SR04_distance_sensor/).

**_InitTimer1_**

Exactly the same as [here](http://bsmitty5000.github.io/mbed/2016/05/19/Getting_Started_with_the_HC-SR04_distance_sensor/). Please note though that Timer1 isn't being used in this project. It's here because I was lazy basically. Initially when I first started with this sensor I was using Timer1 as a way to get a specific frequency of sampling the ADC pins, but since this project is doing it asynchronously, Timer 1 isn't ever turned on.

**_InitADC1_**

```c
void InitADC1() {

    AD1CON1bits.AD12B = 0; //10 bit operation
    AD1CON2bits.VCFG = 0; //using Vdd & Vss as reference
    AD1CON3bits.ADCS = 0x0F; //setting Tad. must be at least 75ns
    //Tad = (ADCS + 1) * Tcy = 16 * (1/40Mhz) = 400ns
    AD1CON3bits.SAMC = 0x01; //auto sample time set to 1 Tad
    //sample + conversion time = (SAMC)*Tad + 12*Tad = 13*Tad = 5.2us
    AD1PCFGL = 0xFFFF; //setting all ports to digital
    AD1PCFGLbits.PCFG0 = 0; //sets AN0 to analog
    AD1CHS0bits.CH0NA = 0; //channel 0 negative input is Vss
    AD1CHS0bits.CH0SA = 0; //setting positive input to AN0
    AD1CON2bits.CHPS = 0; //convert channle 0 only
    AD1CON1bits.ASAM = 0; //manual sampling
    AD1CON1bits.SSRC = 0b111; //manual sample & auto-conversion
    AD1CON1bits.FORM = 0b00; // integer output, top 6 bits 0
    AD1CON2bits.SMPI = 0; //not really using DMA
    IFS0bits.AD1IF = 0; //adc interrupt flag reset
    IEC0bits.AD1IE = 0; //interrupt disabled
    AD1CON1bits.ADON = 1; //turn the key
}
```
This is the meat of the new code for this project. The ADC modules on this PIC are very flexible and pretty powerful too, I think. It can do 10- and 12-bit conversions, and with a 10-bit resolution you can get up to 1Mhz throughput rate. I'm not even really flexing the muscles with this project at all. I think the comments do a good job of describing what's happening, but here's the general idea- I'm setting the ADC up to start sampling manually and the start conversion automatically.  The [reference manual](http://ww1.microchip.com/downloads/en/DeviceDoc/70183D.pdf) section on the ADC, Figure 16-3, shows the process quite nicely. The conversion happens after a certain amount of time has passed after sampling starts, and in this case I have the sample time set to 400ns. This works out to about a 19kHz throughput if I was converting the ADC back to back.

### uart.c
Please see [this](http://bsmitty5000.github.io/mbed/2016/05/14/Communication-between-PIC-and-PC/) for more detail. There's been no changes.

### helpers.c

**_sample_adc_**

```c
unsigned short sample_adc() {

    AD1CON1bits.SAMP = 1;
    while(AD1CON1bits.DONE == 0);
    AD1CON1bits.DONE = 0;
    return ADC1BUF0;
}
```

This is an old function, hence the inconsistent naming scheme used. The purpose is simple, it manually starts the ADC sampling by setting the SAMP bit. The conversion will happen automatically, and the function just spins until the conversion is done, at which point the DONE bit is set high. The DONE bit can be cleared by software (it can't assigned '1'), and it's done here for the next time the function is called. It then just returns the ADC buffer.

### main.c

```c
//main.c
#include "init.h"
#include "uart.h"
#include "helpers.h"
#include <math.h>

// ******************************************************************************************* //
// Configuration bits for CONFIG1 settings. 
//
// Make sure "Configuration Bits set in code." option is checked in MPLAB.
// This option can be set by selecting "Configuration Bits..." under the Configure
// menu in MPLAB.

_FOSC(OSCIOFNC_ON & FCKSM_CSDCMD & POSCMD_NONE);	//Oscillator Configuration (clock switching: disabled;
							// failsafe clock monitor: disabled; OSC2 pin function: digital IO;
							// primary oscillator mode: disabled)
_FOSCSEL(FNOSC_FRCPLL);					//Oscillator Selection PLL
_FWDT(FWDTEN_OFF);					//Turn off WatchDog Timer
_FGS(GCP_OFF);						//Turn off code protect
_FPOR(FPWRT_PWR1);					//Turn off power up timer

//holds the char sent
volatile char uart_rcvd_char;
//flag indicating char has been rcvd
volatile char uart_rcvd;

unsigned short raw_sample;

int main()
{

    //initialize everything
    uart_rcvd_char = 0;
    uart_rcvd = 0;

    //initializations
    InitClock();
    InitUART1();
    InitADC1();

    while(1) {

        if (uart_rcvd == 1) {
            
            uart_rcvd = 0;
            raw_sample = sample_adc();
            sendShort(raw_sample);
        }
        
    }

    return 1;
}
```

**_global variables_**

**uart_rcvd_char**: used to store the byte of data sent by the PC serially (is unused at this point and could be deleted)

**uart_rcvd**: flag to signal a byte has arrived over UART. Set in UART's interrupt routine

**raw_sample**: gets assigned the return value of sample_adc and then is passed into sendShort

**_main_**

The main program starts by initializing the global variables and calling the init procedures.
After this the code is quite simple. It sits in the main while loop waiting for a char to come over the UART from the PC. Once this happens, it samples the ADC and sends the value back over the UART. The program never quits which allows the python script on the computer to be run multiple times without needed to reset the PIC.

**_ _U1RXInterrupt (UART1 Receive interrupt)_**
Please see [this](http://bsmitty5000.github.io/mbed/2016/05/14/Communication-between-PIC-and-PC/) for more detail. There's been no changes.

### read_distance.py

```python
# -*- coding: utf-8 -*-
"""
Testing out HC-SR04 on dsPIC33f
"""
import serial
import struct
import signal
import sys
import matplotlib.pyplot as plt
import numpy as np
import time
        
ser = serial.Serial(port = '/dev/ttyUSB0', 
                    baudrate = 115200,
                    bytesize = 8,
                    parity = serial.PARITY_NONE,
                    stopbits = 1,
                    timeout = 5)

user_in = 'a'
exit_loop = False

x = np.array([])
y = np.array([])

print("q to quit. Will plot entries after leaving loop")

while (not exit_loop) :
    
    user_in = raw_input("Enter distance: ")
    
    if (user_in == 'q'):
        exit_loop = True
    else:
        #log distance
        distance = float(user_in)
        x = np.append(x, distance)
        
        #sample and log adc value
        ser.write('x')
        rcvd = ser.read(2)
        rcvd = struct.unpack('H', rcvd)
        raw_adc = rcvd[0]
        y = np.append(y, raw_adc)
    
    
    
    print("At " + str(distance) + " cm we get " + str(raw_adc))

ser.close()
plt.plot(x, y)
plt.show()  
```

[this](http://bsmitty5000.github.io/mbed/2016/05/14/Communication-between-PIC-and-PC/) project goes more into detail about the serial object.

The jist of this program is setting up the x and y arrays to store the distance and ADC value, respectively. The program goes into a loop waiting for the 'q' character from the user. Otherwise, it converts the user input to a float and stores it into the x array. It then sends the flag to the PIC to sample the ADC and waits for the resonse, which is always going to be 2 bytes for a short. It unpacks this into a short and stores it into the y array.

Once a 'q' comes, the loop exits and the graph prints out.

### results

#### white paper
Apologies for the poor graphs. X axis is in cm and Y axis is in raw ADC counts.

![white paper]({{site.url}}assets/diy_IR_distance_sensor_white_material.png)

#### black paper
![white paper]({{site.url}}assets/diy_IR_distance_sensor_dark_material.png)

## conclusion
Another simple project. It helped me get the IR circuit setup and understand how it works. It also helped me refresh on getting the ADC module up and running on the PIC. Thanks for reading!
