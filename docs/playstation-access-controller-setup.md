# Complete Setup Guide: PlayStation Access Controller for Flock XR

This guide walks you through setting up and configuring the PlayStation Access controller for use with **Flock XR**, covering initial profile creation on the PS5 console, button-to-direction mapping, building an external second joystick for camera control, Bluetooth pairing across **mobile phones (iOS / Android)** and **computers (Windows / macOS)**, and testing.

---

## Step 1: Create & Configure a Profile on the PS5

Before connecting to your mobile device or computer, you must create a custom profile directly on a PlayStation 5 console to assign physical directions to the specific **Button Numbers** used by Flock XR and configure joystick inputs.

1. Connect your Access controller to a PS5 console using the included USB-C cable.
2. Navigate to **Settings** > **Accessibility** > **Access Controller** on the PS5 menu.
3. Select **Create Profile** (or edit an existing custom profile).
4. **Set Orientation**: Select the physical orientation of the controller on your desk/surface so the console correctly registers **North**, **East**, **South**, and **West**.

---

## Step 2: Map Directions to Flock XR Button Numbers & Symbols

In the PS5 button assignment menu, assign each cardinal direction to its corresponding **Flock XR Button Number** and PlayStation face symbol:

| Direction | Flock XR Button Number | PlayStation Symbol Tag | PS5 Input Assignment |
| --- | --- | --- | --- |
| **East** | **Button 1** | **Circle ($\bigcirc$)** | Assign to **Button 1** (or $\bigcirc$) |
| **North** | **Button 2** | **Triangle ($\triangle$)** | Assign to **Button 2** (or $\triangle$) |
| **West** | **Button 3** | **Square ($\square$)** | Assign to **Button 3** (or $\square$) |
| **South** | **Button 4** | **Cross ($\times$)** | Assign to **Button 4** (or $\times$) |

*Tip: You can swap the physical button cap tags ($\bigcirc, \triangle, \square, \times$) on the Access controller so the visual tags match your physical layout.*

---

## Step 3: Configure Joysticks & Build an External Second Joystick (Movement & Camera Control)

Flock XR requires two joysticks for standard 3D navigation (one for player movement and one for camera orientation):

1. **Integrated Left Joystick (Movement)**:
* Configure the built-in joystick on the Access controller as the **Left Stick** in the PS5 controller settings.
* Adjust the stick orientation, sensitivity, and dead zones to match your setup position.


2. **External Right Joystick (Camera Movement)**:
* Because the PlayStation Access controller comes with only one built-in joystick, you will need a second analog stick plugged into one of the 3.5mm expansion ports to handle camera movement.
* You can 3D print and assemble your own custom module using open designs like the **[PS5 Access Controller Second Stick on Thingiverse](https://www.thingiverse.com/thing:6533366)** by Harakan.
* This design uses a standard dual-axis joystick module (such as an Arduino KY-023), a 3.5mm 4-pole audio connector wired to the appropriate pins (Sleeve for Vdd, Ring 2 for Gnd, Ring 1 for X-Axis, Tip for Y-Axis), and a 3D-printed enclosure.
* Plug your completed external joystick into a 3.5mm expansion port on the Access controller, and map it as the **Right Stick** in your PS5 profile settings.



---

## Step 4: Save to Onboard Memory

1. Save the configuration to one of the **3 onboard profile slots** on the Access controller.
2. Unplug the USB cable from the console.
3. Press the physical **Profile Button** on the side/base of the Access controller until the indicator LED shows the slot where you saved this profile.

---

## Step 5: Pair Controller via Bluetooth (Mobile Phones & Computers)

To connect the Access controller wirelessly to the device running Flock XR:

1. **Put the Controller into Pairing Mode**:
* Ensure the controller is turned **OFF** (unplugged and status lights off).
* Press and hold the **PS Button** and the **Profile Button** simultaneously until the **status indicator LEDs** start flashing rapidly.


2. **Connect to Your Device**:
* **Mobile Phones (iOS / iPhone)**:
1. Open **Settings** > **Bluetooth** and turn Bluetooth **ON**.
2. Under **Other Devices**, select **Access Controller** (or *Wireless Controller*).
3. *(Optional)* Go to **Settings** > **General** > **Game Controller** to review profile or button settings.


* **Mobile Phones (Android)**:
1. Open **Settings** > **Connected devices** (or **Connections**) > **Bluetooth**.
2. Tap **Pair new device**.
3. Select **Access Controller** (or *Wireless Controller*) from the list.


* **Windows PC**:
1. Go to **Settings** > **Bluetooth & devices** > **Add device** > **Bluetooth**.
2. Select **Access Controller** (or *Wireless Controller*).


* **Mac (macOS)**:
1. Go to **System Settings** > **Bluetooth**.
2. Locate **Access Controller** under *Nearby Devices* and click **Connect**.





*Once paired, the status indicator LEDs will stop flashing and stay solid.*

---

## Step 6: Test in Flock XR

1. Open **Flock XR** on your mobile phone or computer.
2. Test inputs to verify that pressing each cardinal direction registers the correct software button and PlayStation symbol:
* **East** $\rightarrow$ **Button 1 ($\bigcirc$)**
* **North** $\rightarrow$ **Button 2 ($\triangle$)**
* **West** $\rightarrow$ **Button 3 ($\square$)**
* **South** $\rightarrow$ **Button 4 ($\times$)**


3. Verify that the **Left Joystick** controls character movement and the **External Right Joystick** controls camera rotation smoothly.