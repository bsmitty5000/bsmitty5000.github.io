---
layout: post
title: "interfacing a dsPIC33f and HC-SR04 ultrasonic distance sensor"
date: 2016-05-19
description: Simple project interfacing a dsPIC33f and the hc-sr04 distance sensor and sending the output to a python program on a PC through UART
comments: True
category: mbed
---
## HC-SR04 operation
This is an ultrasonic distance sensor ([datasheet](http://www.micropik.com/PDF/HCSR04.pdf)). The operation is quite simple: it sends out ultrasonic pulses and signals the time it takes for the echo to reach the sensor. To start a reading the input pin, called Trig on the sensor, is asserted for at least 10us. After release there's a short burst of ultrasonic pulses then the output pin, called Echo, is held high until the sensor detects those pulses have returned, at which time it's set low. By timing how long the Echo pin stays high you can use the speed of sound to calculate how far the object is the pulses bounced off of.

### usage notes
After playing around with this sensor a bit it seems the angle of the object really makes a difference, ie. if a signal will even return to the sensor even with an object directly in front of it but at a funny angle. This makes some sense if the object is bouncing those pulses away from the sensor so much that not enough are getting back to the sensor, but I don't know enough about sound waves to say with certainty this is what's happening. I'll have to experiment with this a bit more.

## execution summary

### 3.3V to 5V interface
The dsPIC33f has a handful of 5V tolerant pins that makes it easy to interface with the HC-SR04 without a level converter. The input on the PIC, pin 15,  won't need special setup for this functionality, it simply is able to handle voltage levels up to 5V (the PIC's datasheet has details in section 31.0). But the PIC can't actually drive 5V internally, so the output pin, pin 16 that drives the Trig input on the sensor, needs to be setup as open drain with a pullup resistor. See the diagram below.

### input capture
For timing the Echo on the sensor I used the Input Capture functionality on the PIC. This allowed me to use Timer2 with a frequency of my choosing to automatically time the length between the rising and falling edge of the Echo pin. More info on Input Capture can be found in the related section of the datasheet.

### main loop on the PIC
The structure of the program is 60ms frames which are timed through Timer1's interrupt. The frame begins by triggering the sensor, then it waits for the Input Capture to interrupt so distance calculations can be made. Finally the calculated distance in cm is sent over UART to the program running on the PC. The frame length, 60ms, is suggested by the HC-SR04's datasheet, and must be based on the maximum distance the sensor can sense (although I've seen other sources online that claim the Echo pin will go low automatically at around 38ms, but I haven't tested this).

### python program on PC
The purpose of the python program is to read incoming floats and print out the value. The data coming over the UART will already be in cm, so no conversion is needed, aside from converting the raw bytes to floats ([this](http://bsmitty5000.github.io/mbed/2016/05/14/Communication-between-PIC-and-PC/) will go into more detail).

## project source code links
There's some UART communication between the PIC and the python script using the FT232R breakout board and code from [this](http://bsmitty5000.github.io/mbed/2016/05/14/Communication-between-PIC-and-PC/) project that's reused here, with some pin differences. If anything doesn't make sense refer to that project.

Here's the [link](https://github.com/bsmitty5000/getting_started_with_hc-sr04) for the repo with all the PIC source files and python script for this project.

## hardware connections
Sketch with all three boards, PC, and the 5V supply.

![connections]({{site.url}}assets/intro_hcsr04_hardware.jpg)

## code overview

### init.c

**_InitUART1_**

```c
void InitUART1() {

    //must set to digital
    AD1PCFGLbits.PCFG4 = 1;
    AD1PCFGLbits.PCFG5 = 1;

    //Page 181 of dsPIC33FJ datasheet. This ties RP2 to UART1 RX
    RPINR18bits.U1RXR = 2;
    TRISBbits.TRISB2 = 1;

    // Page 189 of dsPIC33FJ datasheet. This ties RP3 to UART1 TX
    //Table 11-2 lists the decoded values for this register pg 167
    RPOR1bits.RP3R = 3;

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
Check out a previous [project](http://bsmitty5000.github.io/mbed/2016/05/14/Communication-between-PIC-and-PC/) that goes into more detail. Pin locations changed since that project was using up a pair of 5V tolerant pins and I wanted to free those up when interfacing with this sensor. **Note: Because the two pins I chose are also analog input pins, I had to add a few lines to set them to digital, since all analog input pins are set to analog by default.**

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
Unchanged from [this](http://bsmitty5000.github.io/mbed/2016/05/14/Communication-between-PIC-and-PC/).

**_InitTimer1_**

```c
void InitTimer1()
{
	// Clear Timer value (i.e. current tiemr value) to 0
	TMR1 = 0;
        
	T1CONbits.TCS = 0; //source is Fcy
	T1CONbits.TCKPS = 2; //1:64
    //Set PR1 to 60ms
	PR1 = 37500;

	// Clear Timer 1 interrupt flag. This allows us to detect the
	// first interupt.
	IFS0bits.T1IF = 0;

	// Enable the interrupt for Timer 1
	IEC0bits.T1IE = 1;
}
```
Timer1 will be used to time each frame, and it's interrupt will signal the start of a new frame. The HC-SR04 documenation suggests a processing frame of 60ms, which is what this project is currently set to (comments in the project may say 10ms, I'll try to remember to fix that, do the math to make sure).
This procedure sets Timer1's clock source and prescaler. Then it assigns PR1 to a value for 60ms intervals.
The equation for PR1 is:

```
PR1 = [(Time of frame) * (Timer1 clock source frequency)] / (Timer1 prescaler)
```
Where:

* Time of frame is the 60ms mentioned above
* Timer1 in this project is using Fcy, which is set to 40Mhz
* Timer1 is set for 1:64 prescaler
     
So, the equation becomes:

```
PR1 = (60e-3 * 40e6) / 64 = 37500
```    
After configuring, the code clears the interrupt flag and enables the interrupt. The design of the main loop will depend on Timer1's interrupt for control flow. Note the timer is not turned on here.
    
**_InitTimer2_**

```c
void InitTimer2() {

    //Use internal Fcy (40 MHz)
    T2CONbits.TCS = 0;

    //1:8 prescaler
    //5 counts for 1us
    T2CONbits.TCKPS = 1;

    //Turning it on
    T2CONbits.TON = 1;
}
```
Timer2 is used as the counter for the Input Capture module.
The setup is similar to Timer1 without the interrupt configuration. The prescaler value was chosen to try and get the best Timer2 tick frequency, since the raw count values will be used to calculate distance, and 1:8 gives a round 5 ticks per microsecond, using the internal Fcy clock (40MHz) as input. Before leaving the timer is turned on. I decided to turn the timer on here to keep things organized and because the Input Capture uses the differences between two Timer2 readings, so Timer2 doesn't need to be sync'd with the Input Capture initialization.

**_InitHC_SR04_**

```c
void InitHC_SR04() {

    //Pin 16 (RP7) and Pin 15 (RP6) are required for this sensor
    //because they are 5V tolerant

    //Using RP7 for trigger (output)
    TRISBbits.TRISB7 = 0;
    //configure for open-drain to allow 5V on pin
    ODCBbits.ODCB7 = 1;

    //initial value
    LATBbits.LATB7 = 0;

    //Using RP6 as echo (input)
    TRISBbits.TRISB6 = 1;
    //Map IC1 to RP6
    RPINR7bits.IC1R = 6;
    //Interrupt on every 2nd event
    //According to the sensor datasheet the echo pin will only go high
    //after the trigger has been set. So the 2nd event should always be
    //the falling edge
    //IC1CONbits.ICI = 1;

    //setting up timer2
    IC1CONbits.ICTMR = 1;
    
    //Capture events on rising & falling edge
    IC1CONbits.ICM = 1;

    //Setup the IC1 interrupt
    //Set priority level (need to check doc for this) This line is straight
    //from the example in ref manual
    IPC0bits.IC1IP = 1;
    //Clear IF
    IFS0bits.IC1IF = 0;
    //Enable IC1 interrupt
    IEC0bits.IC1IE = 1;

}
```
This routine sets up the two pins interfacing with the sensor.
The first is RP7, pin 15, used as output on the PIC to the Trig pin on the sensor. The setup for this is to assign the TRIS value to 0 to set the pin as output, then assert the pin's ODCB bit.
Next RP6, pin 16, is assigned as Input Capture. First I assign IC1, Input Capture 1, to pin 15 through the RPINR7 register, which is the register assigned to IC1. The next few lines configure IC1 to use Timer2 and capture events on both rising and falling edge. Per the datasheet, when using Input Capture on both edges the PIC will automatically interrupt on both edges, so there's no need to set the interrupt frequency. Then the interrupt is configured, the interrupt flag cleared, and the interrupt enabled. One thing to note, I'm making the assumption that the PIC won't see any edges on this pin except the single rise and fall after the sensor is triggered.

### uart.c
Please see [this](http://bsmitty5000.github.io/mbed/2016/05/14/Communication-between-PIC-and-PC/) for more detail. There's been no changes.

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

//IC1 interrupt flag
volatile char falling_edge_rcvd;

//rising & falling flag
volatile char rising_edge;
volatile unsigned int rising_time, falling_time;

//flag to start new frame
volatile char new_frame_start = 0;

//value to hold number of timer counts of echo
//Timer2 count, with presclaer @ 1:8, is 2E-7s -or-
//5 counts per 1us
volatile unsigned int timer_counts;

//echo period in us
//= timer_counts / 5.0 to convert to us
volatile float period_us;

//distance variable. units are cm
volatile float distance;


int main()
{

    //initialize everything
    uart_rcvd_char = 0;
    uart_rcvd = 0;
    falling_edge_rcvd = 0;
    new_frame_start = 0;
    rising_edge = 1;

    //initializations
    InitHC_SR04();
    InitClock();
    InitUART1();
    InitTimer1();
    InitTimer2();

    //wait for signal from PC
    while(uart_rcvd == 0);

    while(1) {

        //refresh everything
        new_frame_start = 0;

        //clear timer counter and start it up again
        TMR1 = 0;
        T1CONbits.TON = 1;

        //Set Trigger pin high for ~10us (a bit more here)
        LATBbits.LATB7 = 1;
        while (TMR1 < 10);
        LATBbits.LATB7 = 0;

        //wait for timer1 to interrupt indicating new frame
        //do all the calcuations after this
        while(new_frame_start == 0);

        //means echo has gone low and interrupt occurred
        if(falling_edge_rcvd == 1) {

            //logic for rollover of timer2
            if (falling_time > rising_time) {
                timer_counts = falling_time - rising_time;
            }
            else {
                //PR2 resets to 0xFFFF
                timer_counts = (PR2 - rising_time) + falling_time;
            }
            //period_us = (timer_counts / 5.0);
            //distance = period_us / 58.0; //this comes from datasheet, but can just use speed of sound to figure it out
            //combining those two calculations
            distance = timer_counts / 290.0;
            
        }
        else {

            //timeout code just so something gets sent
            distance = -1.0;
        }

        //reset the flag for the next frame
        falling_edge_rcvd = 0;

        sendFloat(distance);
   
    }

    return 1;
}
```

**_global variables_**
**uart_rcvd_char**: used to store the byte of data sent by the PC serially (is unused at this point and could be deleted)
**uart_rcvd**: flag to signal a byte has arrived over UART. Set in UART's interrupt routine
**falling_edge_rcvd**: flag used to signal the falling edge of Echo has been recieved. Required since rising & falling edges will trigger an IC1 interrupt, and the main loop only needs to know when the falling edge has come
**rising_edge**: flag used in IC1's interrupt routine, again because the interrupt will be called for both rising and falling. Initialized to 1 since the first edge ever seen must be rising (if the sensor behaves)
**rising_time, falling_time**: used to store the value of the IC1 buffer, stored in **IC1BUF** automatically through Input Capture logic, that holds the Timer2 count values. The difference between the two will be the length of time, in Timer2 counts, that Echo was asserted.
**new_frame_start**: flag used to signal the start of a new frame. Set in Timer1's interrupt routine.
**timer_counts**: stores the difference in raw Timer2 counts between the rising and falling edge of Echo pin
**period_us**: stores the time, in microseconds, between the rising and falling edge of Echo pin (logic commented out now, could be deleted)
**distance**: final calculated distance of the sensed object in centimeters

**_main_**
The main program starts by initializing the global variables and calling the init procedures.
It then waits for a signal from the PC, sent by the python script, before entering the main loop.
In the main loop, the **new_frame_start** is initialized to zero. This will be asserted in Timer1's interrupt to signify time for a new frame.
Next, **TMR1** is cleared and Timer1 is turned on. This is done here since at the end of each frame the **distance** variable is sent serially to the Python script (which means each frame is actually about 60ms + time to send **distance** @ 115200 baud. Eh it's not like I'm flying a rocket)
Next, the sensor is triggered by asserting pin 16 for the 10us proscribed by the sensor datasheet. **TMR1**, Timer1's raw count value, is used as a crude way to measure 10us, the minimum time the sensor requires to be triggered. I think if you do the math it's a bit more than 10us.
The bulk of the frame will be spent in the while loop waiting for **new_frame_start**, which is asserted in Timer1's interrupt routine. However, between the trigger and exiting this while loop, the Input Capture interrupt handler should be called twice, indicating a rising and falling Echo pin.
I've put in the **falling_edge_rcvd** flag because I'm not 100% sure the Echo pin will always behave, especially if the object doesn't echo back the pulses. So the logic to calculate distance is only done when a falling edge has been received. Next there's a check to see if Timer2 has rolled over. Then distance is calculated. The sensor's datasheet gives a calculation for centimeters if the time is measured in microseconds. But you could always use this equation for other time periods:

```
distance = (Echo high time in seconds) * (340 meters/second) / 2
```
If **falling_edge_rcvd** was not asserted that means there was no falling edge, or maybe even no rising edge, for the Echo pin, so I assign an error value to distance.
The remainder of the main loop resets the **falling_edge_rcvd** flag for the next frame and sends the **distance** value to the PC serially.

**_ _U1RXInterrupt (UART1 Receive interrupt)_**

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
This routine's main job in this project is asserting **uart_rcvd** flag to signal the PC is ready for main loop. More description [here](http://bsmitty5000.github.io/mbed/2016/05/14/Communication-between-PIC-and-PC/).

**_ _IC1Interrupt (Input Control 1 interrupt)_**

```c
void __attribute__((__interrupt__, no_auto_psv)) _IC1Interrupt(void)
{

    unsigned int t1;
    t1 = IC1BUF;
    //Clear IF
    IFS0bits.IC1IF = 0;
    if (rising_edge == 1) {
        rising_time = t1;
        rising_edge = 0;
    }
    else {
        falling_edge_rcvd = 1;
        falling_time = t1;
        rising_edge = 1;
    }

}
```
The raw Timer2 count is stored by the Input Control logic automatically in IC1BUF. Since there's an interrupt every edge, we only need to read from it one time (check datasheet for details). The IF is then cleared. The if-statement ensures that the rising and falling edge values are stored in the appropriate variables.

**_ _T1Interrupt (Timer1 interrupt)_**

```c
void __attribute__((__interrupt__, no_auto_psv)) _T1Interrupt(void)
{

	// Clear Timer 1 interrupt flag to allow another Timer 1 interrupt to occur.
	IFS0bits.T1IF = 0;
    T1CONbits.TON = 0;
    new_frame_start = 1;
}
```
Clears the IF. Then shuts off Timer1. I do this here so UART transmission can occur without any interrupts. Next **new_frame_start** is asserted to let the main loop know it's time to move on.

## conclusion
This is a pretty simple project. It helped me get aquainted with Input Capture on the PIC side and let me play around with this cool sensor. It turns out to be pretty accurate, at least when I put a nice solid object in front of it.
