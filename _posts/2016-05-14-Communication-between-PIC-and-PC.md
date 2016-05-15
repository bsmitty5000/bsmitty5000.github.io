---
layout: post
title: "communication between dsPIC33f and PC"
date: 2016-05-14
description: Using UART and an RT232R chip to enable PIC to PC simple communcation
comments: True
category: mbed
---
## overview
This is a way to enable simple, serial communication between a PIC and PC. It can most likely be used for any PIC ucontroller that has UART, but the actual model I'm using is the dsPIC33FJ64MC802. Please see the [main page](http://www.microchip.com/wwwproducts/en/dsPIC33FJ64MC802) for example code and reference material. [Link to my example project](https://github.com/bsmitty5000/pic_to_pc_comm_uart)

## pic setup

### osc setup
On the reference page for the dsPIC33f there's many example projects that show how to setup the oscillator. For this application I've configured it to run at the max speed of 40 MIPS (Fcy). The datasheet for this PIC shows the calculation and the configuration registers. Here's a snippet from init.c in the project above:

```c
/* 
    Configure Oscillator to operate the device at 40Mhz
    Fosc= Fin*M/(N1*N2), Fcy=Fosc/2
    Fosc= 7.37*(43)/(2*2)=80Mhz for Fosc, Fcy = 40Mhz
*/
PLLFBD = 41; // M = 43
CLKDIVbits.PLLPOST = 0; // N1 = 2
CLKDIVbits.PLLPRE = 0; // N2 = 2
```

### uart setup

#### pin assignment
The tx and rx pins for the UART module can be configured to be almost any of the PIC's I/O pins. The process on how to do this is also defined in the datasheet under the I/O Ports section. Basically, the different input functions have their own register that must be loaded with the value corresponding to the pin you want to use. For example, the UART Receive function uses register RPINR18 and I'm assigning RP7 to this. For output functions, each *pin* has its own register that must be loaded with the value corresponding to the capability you want to assign to that pin. For example, I'm using RP6 as UART tx, so I load RP6's register, RPOR3 with the appropriate value. The values for the different output functions are in Table 11-2. Here's another code snippet:

```c
    //Page 181 of dsPIC33FJ datasheet. This ties RP7 to UART1 RX
    RPINR18bits.U1RXR = 7;

    // Page 189 of dsPIC33FJ datasheet. This ties RP6 to UART1 TX
    //Table 11-2 lists the decoded values for this register pg 167
    RPOR3bits.RP6R = 3;
```

#### uart config and baud rate
In addition to setting up the UART pins, you also must configure the UART's configuration registers. the U1MODE register is the main configuration for UART1 on the dsPIC33f. Another snippet below shows how I'm setting that up. You can use almost any setup you'd like here, but the important thing is you match the settings on the other side, i.e. in this case the application talking with the PIC on the PC. The baud rate register, U1BRG, is filled with the result of the calculation found in the UART Reference Manual section from the website, Section 3.0. [Linked here for convenience](http://ww1.microchip.com/downloads/en/DeviceDoc/70000582e.pdf). This is where it's important that you setup the oscillator correctly with a known Fcy value.

#### sending and receiving setup
It's possible to setup the UART to interrupt on send and recieve, but I kept it simple and chose to just use polling when sending. This keeps the send functions easy to understand. Basically, you load the byte into the U1TXREG and poll the TRMT flag:

```c	
U1TXREG = data;
while(U1STAbits.TRMT == 0);
```

This is possible because I'm in control of when I'm sending bytes and in my application I don't care if I spin inside the send routine. However, I'm not aware of when I'll be recieving so I chose to use interrupts. It is possible to poll for recieving as well, but you won't be able to do much else in your program. The code to setup the interrupt is found in init.c. There's different options for when the interrupt will trigger, found in the datasheet. I chose to interrupt after one byte:

```c
//interrupt after one character is rcvd
U1STAbits.URXISEL = 0;

//clear flag then enable interrupts
IFS0bits.U1RXIF = 0;
IEC0bits.U1RXIE = 1;

U1MODEbits.UARTEN = 1; //enable uart
U1STAbits.UTXEN = 1; //transmitter enabled
```

### sending and recieving routines

#### sending
Like I showed above, the send routines are quite basic. The only interesting part of the send routines is sending floating point values. For that I used the union data structure in C. Unions are quite interesting and if you haven't used them before check [this](http://www.tutorialspoint.com/cprogramming/c_unions.htm) out. With this data structure, I can separate out all the bytes associated with the floating point values and send them one by one:

```c
	union convUnion myUnion;
	myUnion.f = data;

	U1TXREG = myUnion.bytes[0];
	while(U1STAbits.TRMT == 0);
	U1TXREG = myUnion.bytes[1];
	while(U1STAbits.TRMT == 0);
	U1TXREG = myUnion.bytes[2];
	while(U1STAbits.TRMT == 0);
	U1TXREG = myUnion.bytes[3];
	while(U1STAbits.TRMT == 0);
```

#### receiving
Like I showed above, I'm using interrupts to receive. But it's still pretty basic, since I know the interrupt fires after one byte. I used a global flag to let my main program know something's arrived and store the recieved byte into a global char. Don't forget to clear the IF. Here's the code found in my interrupt routine:

```c
// Clear interrupt flag
IFS0bits.U1RXIF = 0;
//let the main loop know we received a char
uart_rcvd = 1;
//load the char
uart_rcvd_char = U1RXREG;
```

## rt232r
I found this [breakout board](https://www.sparkfun.com/products/12731) with the RT232R chip on Sparkfun. It seems like theres much more capability than what I'm using, but if you look at the actual chip's [datasheet](https://cdn.sparkfun.com/datasheets/BreakoutBoards/DS_FT232R.pdf), I'm basically following the setup in Section 7.4 (ignoring the hardware handshaking).

After setting up the PIC with the correct pins for UART functionality, you connect the UART tx pin on the PIC to the Receive Data (RXD) pin on the RT232r, and vice versa for the UART rx pin on the PIC. Don't forget to connect the Vss on the PIC to GND on RT232r as well.

## python script
On the PC side I used python and the pySerial package running on a Ubuntu machine. They have some good example code [here](https://pythonhosted.org/pyserial/shortintro.html#opening-serial-ports). It's quite simple if you know how the PIC's UART is configured. The RT232R basically acts as a via that translates the UART signals from the PIC into something the computer can read, but it's still serial communication, so it is important, for example, that the baudrate in the Serial object matches what's on the PIC. Here's a snippet from my python script setting it up:

```python
ser = serial.Serial(port = '/dev/ttyUSB0', 
                    baudrate = 115200,
                    bytesize = 8,
                    parity = serial.PARITY_NONE,
                    stopbits = 1,
                    timeout = 3)
```

### ttyUSBx issues
Now your port may be different than what's here. The way I figure out which port is using this command line tool below:

```
dmesg | grep tty
```

You may also run into permission issues. I found [this](http://askubuntu.com/questions/58119/changing-permissions-on-serial-port) discussion on ask ubuntu to be quite helpful.

### decomming the floating point bytes
To rebuild the floating points from bytes I used the [struct python package](https://docs.python.org/2/library/struct.html). The documentation is pretty good. Here's yet another code snippet from the project:

```python
if op == 'f' or op == 'd':
    rcvd = ser.read(4)
    rcvd = struct.unpack('f', rcvd)
```

## project description
The bulk of this project is a demonstration of the UART capability. The main function running on the PIC waits for certain flag chars sent by the Python script. For numerical demonstration I've simply loaded constant values that will be sent back to the PC after the correct flag is sent. For example, to send a floating point from the PIC you type in 'f' at the prompt from the python script. 

I also wanted to show how easy it is to send multiple bytes at a time, so the 'w' option in the python script will let you type in a word, up to 80 characters long, and the PIC will echo the whole word back to you.

## conclusion
With this RT232R chip it's quite easy to establish some communication between a PIC and PC. I use this to debug different applications on the PIC and it's worked quite well for me. Thanks for reading!
