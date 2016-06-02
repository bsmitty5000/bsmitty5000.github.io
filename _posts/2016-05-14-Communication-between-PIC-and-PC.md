---
layout: post
title: "communication between dsPIC33f and PC"
date: 2016-05-14
description: Using UART and an FT232R chip to enable PIC to PC simple communcation
comments: True
category: mbed
---
## usb to serial converter
This project uses the FT232R chip on a Sparkfun breakout board found [here](https://www.sparkfun.com/products/12731)

## execution summary
This program's purpose is simply to demonstrate communication between a PIC and PC using UART. The python script on the PC gives options for different data types for the PIC to send serially. The python script sends a flag to indicate which data type should be sent, based on user input, and the PIC responds by sending an example value. There's also a capability to send an entire string from the python script and have the PIC echo it back.

## project source code links
The [main page](http://www.microchip.com/wwwproducts/en/dsPIC33FJ64MC802) for this PIC model, the dsPIC33FJ64MC802, has  example code and reference material. [Link](https://github.com/bsmitty5000/pic_to_pc_comm_uart) to repo with all source code.

## hardware connections
Sketch of the FT232R breakout board and PIC.

![connections]({{site.url}}assets/pic_to_pc_serial.JPG)

## code overview

### init.c

**_InitUART1_**

```c
void InitUART1() {

    //Page 181 of dsPIC33FJ datasheet. This ties RP7 to UART1 RX
    RPINR18bits.U1RXR = 7;

    // Page 189 of dsPIC33FJ datasheet. This ties RP6 to UART1 TX
    //Table 11-2 lists the decoded values for this register pg 167
    RPOR3bits.RP6R = 3;

    U1MODEbits.STSEL = 0; //1 stop bit
    U1MODEbits.PDSEL = 0; //8 bit data, no parity
    U1MODEbits.ABAUD = 0; //auto-baud disabled
    U1MODEbits.BRGH = 0; //standard speed mode

    //check ref manual uart section for calculation
    if (BAUDRATE == 115200)
        U1BRG = 20;
    else if (BAUDRATE == 9600)
        U1BRG = 256;
    else
        U1BRG = 0xFF;

    //not using interrupts for transmit, polling instead
    //U1STAbits.UTXISEL0 = 0;
    //U1STAbits.UTXISEL1 = 0;
    //IEC0bits.U1TXIE = 1;

    //interrupt after one character is rcvd
    U1STAbits.URXISEL = 0;
    
    //clear flag then enable interrupts
    IFS0bits.U1RXIF = 0;
    IEC0bits.U1RXIE = 1;

    U1MODEbits.UARTEN = 1; //enable uart
    U1STAbits.UTXEN = 1; //transmitter enabled

    //IFS0bits.U1TXIF = 0;

}
```
This routine sets the rx and tx pins for the UART and configures the UART module.
The UART rx and tx pins are mapped through the PIC's Peripheral Pin Select functionality. This functionality allows any of the RPx pins to be mapped to a handful of functions for flexibility. The input pins are mapped by assigned the RP number, eg the 7 in RP7, to the peripheral's register (UART1 Receive's register is **RPINR18**). Output pins all have their own register. Table 11-2 in the datasheet shows the numerical value assigned to each peripheral. The numerical value is then written to the desired pin's register, eg UART1 Transmit is 0b00011 which is written to RP6's register, **RPOR3**.
Next, the procedure sets up the UART module in typical fashion. The baudrate for UART1 is determined by the value written to **U1BRG**. The calculation, found in the UART reference manual, is:

```
U1BRG = (Fosc / 2) / (16 * Desired BaudRate) - 1
```
Where in this project:

* Fosc has been configured to 80Mhz (Fcy = 40Mhz)
* The desired baudrate is 115200

So, the equation becomes:

```
U1BRG = (40Mhz / 2) / (16 * 115200) - 1 = 20
```
Interrupts are only configured for receiving, since when transmitting the program will use the polling method. There is a buffer associated with the UART module, but this program doesn't use it and interrupts after each byte is received.
Finally, the transmitter and receiver are enabled.

**_InitClock_**

```c
void InitClock() {
    /* Configure Oscillator to operate the device at 40Mhz
       Fosc= Fin*M/(N1*N2), Fcy=Fosc/2
       Fosc= 7.37*(43)/(2*2)=80Mhz for Fosc, Fcy = 40Mhz */
    PLLFBD = 41; // M = 43
    CLKDIVbits.PLLPOST = 0; // N1 = 2
    CLKDIVbits.PLLPRE = 0; // N2 = 2
    OSCTUN = 0;
    RCONbits.SWDTEN = 0;

    // Clock switch to incorporate PLL
    __builtin_write_OSCCONH(0x01); // Initiate Clock Switch to
    // FRC with PLL (NOSC=0b001)
    __builtin_write_OSCCONL(0x01); // Start clock switching
    while (OSCCONbits.COSC != 0b001); // Wait for Clock switch to occur

    while (OSCCONbits.LOCK != 1) {
    };
}
```
The oscillator is setup to use the internal crystal through configuration macros in the main.c file. This procedure proceeds to configure the value of Fosc to a frequency of 80Mhz. The calculation for this, found in the  Oscillator Configuration section of the datasheet, is:

```
Fosc = Fin * [M / (N1 * N2)]
```
Where,

* Fin is the internal osc frequency, 7.37Mhz
* M is set to 43 by assigning **PLLFBD** to 41 (see datasheet, but **PLLFBD** register contains **PLLDIV**, which = M - 2
* N1 & N2 are set to 2 by assigning **PLLPOST** and **PLLPRE** to 0, respectively (again, see datasheet, but **PLLPOST** and **PLLPRE** are both = Nx - 2)

So, finally the equation works out to confirm Fosc = 80Mhz:

```
Fosc = 7.37Mhz * [43 / (2 * 2)] = 79 Mhz ~= 80Mhz
```
The remainder of the procedure waits until the PLL circuit has finished settling. I actually found this code in one of the application examples on the PIC's website and don't understand all the details.

### uart.c

**_send_**

```c
void send(unsigned char data)
{
	U1TXREG = data;
	while(U1STAbits.TRMT == 0);
}
```
Basic send routine that transmits one byte. The polling method is used here because it's easy. the **TRMT** bit is asserted when the transmit shift register is empty. The downside to this method is one byte is sent at a time, ie multiple bytes are sent individually. The upside is simplicity.

**_sendShort_**

```c
void sendShort(unsigned short data)
{
	unsigned char temp;

        //sending lsb first
	temp = data;
	U1TXREG = temp;
	while(U1STAbits.TRMT == 0);
	temp = data >> 8;
	U1TXREG = temp;
	while(U1STAbits.TRMT == 0);
	
}
```
This routine sends two bytes, with the order sending the least significant byte first. This matches the endian on my machine. Like mentioned above, the polling method means bytes aren't sent back-to-back, but individually.

**_sendDouble_**

```c
void sendDouble(double data)
{
	union convUnion myUnion;
	myUnion.d = data;

    U1TXREG = myUnion.bytes[0];
	while(U1STAbits.TRMT == 0);
	U1TXREG = myUnion.bytes[1];
	while(U1STAbits.TRMT == 0);
	U1TXREG = myUnion.bytes[2];
	while(U1STAbits.TRMT == 0);
	U1TXREG = myUnion.bytes[3];
	while(U1STAbits.TRMT == 0);
	
}
```
This routine sends a 4-byte floating point. To do this, a union type is used so the individual bytes of the floating point variable can be accessed. The union definition, found in **_uart.h_** is:

```c
union convUnion
{
	double d;
	float f;
	unsigned char bytes[4];
};
```
So both floats and doubles can be used with this. Each of the bytes are accesible through their index. Again, the order of sending jives with the endian of my machine (basically found through trial & error, I'm not smart enough to figure it out ahead of time).

**_sendFloat_**
Exact same code as **_sendDouble_**, just the input parameter is set for **float** type.

### main.c

```c
//main.c
#include "init.h"
#include "uart.h"
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

//stores the word
volatile char word_rcvd[80];
//starts putting the rcvd chars into the word
volatile char word_mode;


int main()
{

    //initialize everything
    uart_rcvd_char = 0;
    uart_rcvd = 0;

    word_mode = 0;
    int word_length = 0;
    int i;

    InitClock();
    InitUART1();

    while(1) {

        if (uart_rcvd == 1) {

            //word mode fills up the string then sends when a newline comes
            if (word_mode == 1) {

                //word is done, now send it and restart
                if(uart_rcvd_char == '\n') {
                    for (i = 0; i < word_length; i++) {
                        send(word_rcvd[i]);
                    }
                    word_length = 0;
                    word_mode = 0;
                }
                //just keep filling up the word
                else {
                    word_rcvd[word_length] = uart_rcvd_char;
                    word_length++;
                }
            }
            else {
                //test sendFloat
                if (uart_rcvd_char == 'f') {
                    sendFloat(3.1415);
                }
                //test sendDouble
                else if (uart_rcvd_char == 'd') {
                    sendDouble(1.618);
                }
                //test sendShort
                else if (uart_rcvd_char == 's') {
                    sendShort(42);
                }
                //test send
                else if(uart_rcvd_char == 'c') {
                    send('a');
                }
                //start up word mode
                else if(uart_rcvd_char == 'w') {
                    word_mode = 1;
                }
            }

            //reset flag
            uart_rcvd = 0;
        }
    }

    return 1;
}
```

**_global variables_**
**uart_rcvd_char**: used to store the byte of data sent by the PC serially. Set in the UART Receive interrupt
**uart_rcvd**: flag to signal a byte has arrived over UART, set in the UART revieve interrupt
**word_rcvd[80]**: used when the python script indicates a word will be sent over UART. The PIC stores each char, up to a limit of 80, and then echos the word back to the python script
**word_mode**: flag used to indicate if a word is being sent, so the program knows to store each byte received until a newline character is received indicating the end of the word

**_local variables_**
**word_length**: counter used to count how many characters have been sent in the string. Used when echoing the string back to the PC
**i**: loop counter

**_main_**
The main routine initializes the global variables and instantiates the local variables, and calls the init routines to setup the Osc and UART module.
The main loop then waits for a byte to come over the UART, the value of which determines the next actions. There's an option for the following data types:

* float
* double
* short
* char

When one of these options comes from the PC, the PIC responds by sending an example variable back. The values of these examples are hardcoded since this is just a demo.
There's also a char that indicates a word will be coming from the PC. When this char is received the PIC asserts the **word_mode** flag and will store all incoming chars in the **word_rcvd** char array until a new line character is received. It then will echo back the entire word.
It continually stays in this loop waiting for input from the PC.

**_ _U1RXInterrupt_**

```c
void __attribute__((__interrupt__, no_auto_psv)) _U1RXInterrupt(void)
{

	// Clear interrupt flag
	IFS0bits.U1RXIF = 0;
    //let the main loop know we received a char
    uart_rcvd = 1;
    //load the char
    uart_rcvd_char = U1RXREG;
}
```
The interrupt routine for UART1 receive. It clears the interrupt flag and sets the **uart_rcvd** global flag so the main loop knows a character has been received. It stores the actual value, set automatically by the UART logic in register **U1RXREG** in the global variable, **uart_rcvd_char** for the main loop to read.

### uart_dspic33f.py

```python
# -*- coding: utf-8 -*-
"""
Testing out UART on dsPIC33f
"""
import serial
import struct    

ser = serial.Serial(port = '/dev/ttyUSB0', 
                    baudrate = 115200,
                    bytesize = 8,
                    parity = serial.PARITY_NONE,
                    stopbits = 1,
                    timeout = 3)

op = 'x'
rcvd = 'x'

def send_word():
    print(' ')
    print(' ')
    print('Type in a word. Must be less than 80 characters.')
    print('The stop tx char will automatically be inserted.')
    
    word_length = 81
    while word_length > 80:
        word_2_send = raw_input('Enter string (< 80 char): ')
        word_length = len(word_2_send)
    
    ser.write(word_2_send)
    #using new line to tell the PIC we're done
    ser.write('\n')
    
    rcvd = ser.read(len(word_2_send))
    
    print(' ')
    print(' ')
    print('Echo from PIC: ')
    print(rcvd)

def print_options():
    print(' ')
    print(' ')
    print('q - quit')
    print('f - test float')
    print('d - test double')
    print('s - test short')
    print('c - test char')
    print('w - send word')


while op != 'q':
    
    print_options()
    op = raw_input('Enter choice: ')
    if op != 'q':
        ser.write(op)
    if op == 'f' or op == 'd':
        rcvd = ser.read(4)
        rcvd = struct.unpack('f', rcvd)
        print(rcvd)
    elif op == 's':
        rcvd = ser.read(2)
        rcvd = struct.unpack('H', rcvd)
        print(rcvd)
    elif op == 'c':
        rcvd = ser.read()
        print(rcvd)
    elif op == 'w':
        send_word()
    
print('Thanks for playing!')
ser.close()
```

**_global variables_**
**ser**: serial object, configured to match the UART configuration on the PIC
**op**: character used to store the user input from the keyboard
**rcvd**: character used to store the input from the PIC

**_send_word_**
This function gets called when the word option is requested. It asks for a string to be typed in and does perform a check to make sure it's less than 80 characters. After sending the string the function sends the new-line flag to signal the PIC the word has completed. It then sits and waits for the PIC to echo back the string and prints the word.

**_print_options_**
Just a helper function to print out the available options.

**_main_**
This loop continues until the option to quit is selected. For each of the data types, the appropriate number of bytes to wait for from the PIC is hardcoded.
Note: the short and float/double type require the bytes to be unpacked into the appropriate python datatype. The documentation for the struct package can be found [here](https://docs.python.org/2/library/struct.html)
pySerial package documentation can be found [here](https://pythonhosted.org/pyserial/shortintro.html#opening-serial-ports).

### ttyUSBx issues
The port the FT232R shows up on can change. I don't have an automatic way of figuring this out, only by the python script erroring out when trying to instantiate the serial object because that particular ttyUSBx doesn't exist. On Linux, this command will help determine which port to use:

```
dmesg | grep tty
```

If there's still an issue with reading, it could be permission issues. [This](http://askubuntu.com/questions/58119/changing-permissions-on-serial-port) discussion on ask ubuntu was helpful.

## conclusion
With this FT232R chip it's quite easy to establish some communication between a PIC and PC. I use this to debug different applications on the PIC and it's worked quite well for me. Thanks for reading!
