---
layout: post
title: "wireless communication between PIC and Arduino"
date: 2016-08-29
description: Testing out the si4432 with a dsPIC33f and Arduino 32u4 Mini LV
comments: True
category: mbed
---
## the si4432

I found [this](http://www.ebay.com/itm/SI4432-470MHz-1000m-Wireless-Module-470M-433mhz-Wireless-Communication-Module-/200932667345?hash=item2ec8852fd1:g:-ccAAOSw7ehXSPMY) transceiver on ebay and decided to try it out. The official [page](http://www.silabs.com/products/wireless/EZRadioPRO/Pages/Si44303132.aspx) has everything needed to get started, particularly this [guide](http://www.silabs.com/Support%20Documents/TechnicalDocs/AN415.pdf) and this [spreadsheet](http://www.silabs.com/Support%20Documents/Software/Si443x-Register-Settings_RevB1.xls), which calculates register values based on the specific settings chosen.

## project overview

To get a taste of how to work with the si4432 I decided to get an Arduino and the dsPIC33f talking to each other using a pair of the transceivers. The [Arduino](https://www.pololu.com/product/3103) is an A* 32U4 Mini LV from Pololu, which from my best guess resembles a Leonardo and uses an ATmega32U4. There is an Arduino library already developed for something called the RF22, I think the si4432 is an updated product but essentially the same. I don't use that library but it can be found [here](http://www.airspayce.com/mikem/arduino/RF22/).
The PIC is the [dsPIC33f](http://www.microchip.com/wwwproducts/en/dsPIC33FJ64MC802) running on the Microstick. The most complicated part for the PIC here is getting the SPI setup, which is slightly more involved than the Arduino.

[Git repo](https://github.com/bsmitty5000/test_driving_the_si4432) with the PIC and arduino code.

## hardware connections

![connections]({{site.url}}assets/si4432_test/si4432_test.JPG)

Fancy drawing showing how the two microcontrollers connect to the si4432 chip. ***Pretty glaring omission I noticed later: Pin 11 on the si4432, SDN, should be tied to ground. It's easy since they're right next to each other. This keeps the si4432 out of shutdown mode. If you want to use shutdown mode, you'll have to connect that to a digital pin*** 

The PIC doesn't have a Vout pin so I used the 3.3V pin from the FT232R chip, since I had that connected initially anyways when debugging the SPI so the PIC could talk to the PC. Other than that though, the PIC didn't need any other help connecting since its logic level is already 3.3V.

The Arduino, on the other hand, needed a Logic Converter/Level Shifter to communicate with the si4432, since the Arduino logic level is 5V. I used [this](https://www.sparkfun.com/products/12009) Level Converter from Sparkfun. SPI uses 4 pins, and to connect with the si4432 you really need 5 logic pins, the extra being for the nIRQ interrupt pin. I figured it would be OK to directly connect that to the Arduino though, since the 3.3V coming from the si4432 falls within the arduinos logic high voltage range. I found in some comments on their site that the max SPI frequency was around 2MHz. I played around a bit with different frequencies with all the SPI pins connected to my [Logic 8](https://www.saleae.com/) logic analyzer. Here's a few snapshots of the SCLK signal at different frequencies:

![connections]({{site.url}}assets/si4432_test/analog_4mhz.png)
Image above: 4MHz SCLK

![connections]({{site.url}}assets/si4432_test/analog_2mhz.png)
Image above: 2MHz SCLK

![connections]({{site.url}}assets/si4432_test/analog_1mhz.png)
Image above: 1MHz SCLK

The weird thing is the digital capture for each of those frequencies shows the exact same capture, like there's no dropped pulses whatsoever. I can't really explain that, other than the logic analyzer isn't capturing fast enough to see the entire signal, but I was capturing at 10MHz, which should have been fast enough even for the 4MHz clock. In any case, I kept it at 1MHz since my application doesn't really care.

## si4432 setup overview

Here's the setup I used for the si4432 to configure the registers using the spreadsheet linked above:

* GFSK modulation: The datasheet suggests this as the most robust modulation scheme
* 433.92MHz RX/TX frequency: The ebay item description used this frequency and I assumed it was due to the length of the attenna
* 9.6kpbs transmission rate: This is used in the guide linked above and I had no reason to change it
* 45kHz frequency deviation: Again, from the guide and no reason to use a different value
* Packet Handler is turned ON: From the guide and datasheet, this is by far the easiest way to get up and running
* CRC16-IBM: Another one from the guide
* FIFO mode turned ON: Very easy way of sending data from the PIC, just write the data in byte-sized chunks to the FIFO address
* Auto-Frequency Calibration (AFC) turned ON: seemed like a good idea based on the description in the datasheet
* 10 byte header: When AFC is enabled this is the suggested size from the guide linked above
* Variable packet length: The length is written to the Transmit Packet Lenght (0x3E) before transmission and is sent over before the payload so the receiving module will know how long the packet is upon receipt

After those options are set in the spreadsheet, leaving the remaining options as default, the spreadsheet will give the appropriate values for all the required registers.

## spi on the PIC

**_init_spi_**

```c
void init_spi() {

    //configuring the PPS
    //SDO on RP9
    RPOR4bits.RP9R = 7;
    //SDI on RP8
    RPINR20bits.SDI1R = 8;
    //SCLK on RP7
    //ref man states you have to configure input/output
    RPOR3bits.RP7R = 8;
    RPINR20bits.SCK1R = 7;

    //configuring SS on RB6
    TRISBbits.TRISB6 = 0; //output only
    LATBbits.LATB6 = 1; //initialize to high (idle on Si4430)

     /* The following code sequence shows SPI register configuration for Master mode */
    IFS0bits.SPI1IF = 0;                // Clear the Interrupt flag
    IEC0bits.SPI1IE = 0;                // Disable the interrupt

    // SPI1CON1 Register Settings
    SPI1CON1bits.DISSCK = 0;            // Internal serial clock is enabled
    SPI1CON1bits.DISSDO = 0;            // SDOx pin is controlled by the module
    SPI1CON1bits.MODE16 = 1;            // Communication is word-wide (16 bits)
    SPI1CON1bits.MSTEN = 1;             // Master mode enabled
    SPI1CON1bits.SMP = 0;               // Input data is sampled at the middle of data output time
    SPI1CON1bits.CKE = 1;               // Serial output data changes on transition from
                                        // active clock state to Idle clock state
    SPI1CON1bits.SPRE = 6;              // secondary presclaer 2:1
    SPI1CON1bits.PPRE = 2;              // primary prescaler 4:1
    SPI1CON1bits.SSEN = 0;              // in master need to manually control this
    //SCLK = Fcy / (secondary * primary) = 40MHz / 8 = 5MHz

    SPI1CON1bits.CKP = 0;             // Idle state for clock is a low level;

    // active state is a high level
    SPI1STATbits.SPIEN = 1;           // Enable SPI module

}
```
I'm pretty sure most of this is easy to understand from the comments, even if I tried coming back six months from now. For some reason I decided to use 5MHz, I think because the math made it funny to get anything else below 10MHz, the si4432's limit. The equation for the SPI clock is up in the comments and I grabbed that from the reference manual. Before you dive into the actual SPI settings, the individual SPI pins must be configured using the Peripheral Pin Select. A review of that can be found in [this](http://bsmitty5000.github.io/mbed/2016/05/14/Communication-between-PIC-and-PC/) earlier post.

## main program logic

A quick overview of what the actual program is doing, which can be found in the main while loop of main.c and the main loop of the si4432_test.ino arduino code. Note that the setup for the si4432 is exactly the same for both the transmitter and the receiver. Well, in this application, each chip is sending and receiving. In a nutshell, the PIC initiates a transaction every 250ms (by using Timer1. A Timer1 initialization refresher is [here](http://bsmitty5000.github.io/mbed/2016/05/19/Getting_Started_with_the_HC-SR04_distance_sensor/)). After transmitting, it then sets itself up into receive mode and waits for an ack from the arduino. On the arduino, it initially sets itself up to receive and waits for the PIC's incoming message. Once it comes it prints the message to the serial port so I can watch it on the PC. Then it sets itself up to transmit and sends over an ack, which changes each 250ms frame to help in debugging. The PIC then takes that ack content and uses it as the next message. This way I can watch what the arduino is printing and make sure it's incrementing correctly, through which I can imply that everything is working OK. 

### transmitting

Here's a snippet from main.c, lines 64 - 89:

```c
//Write the length of the message to be sent
write_register(0x3E, length);

//Fill up the TX FIFO
for (i = 0; i < length; i++) {
    write_register(0x7F, message[i]);
}

//disable all other interrupts and enable packet sent interrupt
write_register(0x05, 0x04);
write_register(0x06, 0x00);

//read interrupt status regs to clear
int_status1 = read_register(0x03);
int_status2 = read_register(0x04);

//enable transmitter
write_register(0x07, 0x09);

//wait for packet to be sent. The ipksent interrupt will trigger
//the nIRQ line to be brought low
while (PORTAbits.RA4 == 1);

//clear interrupt status regs
int_status1 = read_register(0x03);
int_status2 = read_register(0x04);
```

The configuration I'm using for the si4432 makes transmitting and receiving ridiculously easy. Since it's a variable payload, first thing is writing the length of the payload to the correct register. Next, simply write to the FIFO register consecutively with each character of the message. Clear all possible interrupts by reading the two status registers and enable the transmitter. Then I'm polling the nIRQ pin, only for simplicity, it would be easy to setup a Change Notification on the PIC so that the processor could be freed up and you just have to wait for the interrupt. I'll probably do that for later projects when I actually use this thing for something useful. Last, clear the status registers by reading. There will actually be a bit set this time around, but for transmitting it's enough just to know the interrupt occurred.

### receiving

Here's a snippet from the si4432_test.ino arduino code where it's waiting for the message from the PIC, the first chunk of code is in the setup() function and the meat of the receive function is in the loop():

```c
//These next few lines are found in the setup() function
//Default for Arduino is rcv mode
//Write to Op Mode & Func Control 1 to set
//rcv mode and Xtal on
write_register(0x07, 0x05);

//enable two interrupts
//one for valid message 'ipkval'
//one for invalid CRC error 'icrcerror'
write_register(0x05, 0x03);
write_register(0x06, 0x00);

//clear interrupt status regs
int_status1 = read_register(0x03);
int_status2 = read_register(0x04);
  
//loop() starts here:

//Poll the nIRQ pin each loop
//When a message has arrived the interrupt
//will be set and the pin brought low
if (digitalRead(nIRQ_pin) == LOW) {

//Extra line because of the dot printing
Serial.println();
Serial.println("Got something");

//read interrupt status regs
int_status1 = read_register(0x03);
int_status2 = read_register(0x04);

//Checking if there was a CRC error
if((int_status1 & 0x01) == 0x01) {
  
  //disable rcv chain
  write_register(0x07, 0x01);
   
  write_register(0x08, 0x02);
  write_register(0x08, 0x00);
   
  Serial.println("CRC Error!!");
   
  write_register(0x07, 0x05);
}

//Checking if the message is without errors
if((int_status1 & 0x02) == 0x02) {
 
  //disable rcv chain
  write_register(0x07, 0x01);

  //Read length of the message
  buff_len = read_register(0x4B);
 
  //Safeguard to make sure there's enough room in the buffer
  if(buff_len <= buff_max) {
   
    for(i = 0; i < buff_len; i++) {
     
     message_buffer[i] = read_register(0x7F);
      
    }
   
  }
  
  Serial.print("Message rcvd: ");
  Serial.println(message_buffer);
  
  //reset rcv FIFO
  write_register(0x08, 0x02);
  write_register(0x08, 0x00);
  
  //Note that the if-statement isn't closed off since
  //the arduino is sending an ack when a valid message
  //comes in, but that's just a repeat of the transmit
  //stuff above
```

Just like transmitting, receiving is ridiculously easy on this chip. First the si4432 is put into receive mode. There's two interrupts to enable, one for a valid message and one for a CRC error. Clear the status registers by reading and that's it. Again, polling the nIRQ could be done through some sort of Change Notification, but I'm not as sure how to do that on the Arduino. In any case, I'm just polling here since I have nothing better to do. After an interrupt comes in, the code checks to see if the CRC error caused the interrupt. If so, I just chose to write "CRC Error" to the serial I/O. Actually, it should probably either stop the arduino completely or send an ack to the PIC that there was an error, something I'll change for future applications. It then checks to see if the message was valid. If so, the receiver chain is disabled so no new messages come in unexpectedly. The length of the payload is read and the receive FIFO is cleared out by consecutive reads. The recieve FIFO can be cleared as the final portion of the receive section. The arduino then goes on to send the ack to the PIC (not shown), but it could also just enable the receive like the code in setup().

## conclusion

I was able to transmit and receive with both chips. It wasn't anything spectacular and, actually, there's some poorly written logic when it comes to sending & receiving, error handling, etc., but my main purpose was confirming I could get something to wiggle. The si4432 is incredibly easy to use if you have the right resources, especially the register cheat spreadsheet. The next project will be using these to get a small RC car working. I haven't tested the range or anything but since I'll only ever run it in a small room with line-of-sight it should be OK.

