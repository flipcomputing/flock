# Complete Setup Guide: PlayStation Access Controller for Flock XR

> **Disclosure:** This guide was drafted with AI (Google Gemini) assistance and reviewed and verified by a human.

---

> **Note on Accessibility Controllers (PlayStation Access, Xbox Adaptive Controller, & Other Systems):**
> Flock XR relies on a standard 4-way cardinal spatial button layout (1 at East, 2 at North, 3 at West, 4 at South). Even if an adaptive controller—such as the **Xbox Adaptive Controller (XAC)** for Xbox One/Series/PC, **Logitech Adaptive Gaming Kit**, or custom switch interfaces—does not feature PlayStation geometric symbols ($\bigcirc, \triangle, \square, \times$), the exact same setup principles apply across all accessibility hardware. On an Xbox Adaptive Controller or Xbox-compatible setup, simply map whichever physical switches, jack inputs, or buttons occupy those spatial positions to Buttons 1 through 4 (or $B, Y, X, A$) in the Xbox Accessories app or your controller's profile settings.

---

## Step 1: Create & Configure a Profile on the PS5

Before connecting to your mobile device or computer, you must create a custom profile directly on a PlayStation 5 console to assign physical positions to the specific **Button Numbers** used by Flock XR and configure joystick inputs.

1. Connect your Access controller to a PS5 console using the included USB-C cable.
2. Navigate to **Settings** > **Accessibility** > **Access Controller** on the PS5 menu.
3. Select **Create Profile** (or edit an existing custom profile).
4. **Set Orientation**: Select the physical orientation of the controller on your desk or mounting surface so the console correctly registers the **North**, **East**, **South**, and **West** cardinal layout around the button ring.

---

## Step 2: Map Cardinal Positions to Flock XR Button Numbers & Symbols

In the PS5 button assignment menu, assign each cardinal position around the controller ring to its corresponding **Flock XR Button Number** and PlayStation face symbol:

| Spatial Position | Flock XR Button Number | PlayStation Symbol Tag | PS5 Input Assignment | Xbox Equivalent |
| --- | --- | --- | --- | --- |
| **East** | **Button 1** | **Circle ($\bigcirc$)** | Assign to **Button 1** (or $\bigcirc$) | **B Button** |
| **North** | **Button 2** | **Triangle ($\triangle$)** | Assign to **Button 2** (or $\triangle$) | **Y Button** |
| **West** | **Button 3** | **Square ($\square$)** | Assign to **Button 3** (or $\square$) | **X Button** |
| **South** | **Button 4** | **Cross ($\times$)** | Assign to **Button 4** (or $\times$) | **A Button** |

*Tip: You can swap the physical button cap tags ($\bigcirc, \triangle, \square, \times$) on the Access controller so the visual tags match your physical spatial layout.*

---

## Step 3: Configure Joysticks & Build an External Second Joystick (Movement & Camera Control)

Flock XR requires two joysticks for standard 3D navigation (one for player movement and one for camera orientation):

1. **Integrated Left Joystick (Movement)**:
* Configure the built-in joystick on the Access controller as the **Left Stick** in the PS5 controller settings.
* Adjust the stick orientation, sensitivity, and dead zones to match your setup position.


2. **External Right Joystick (Camera Movement)**:
* Because the PlayStation Access controller comes with only one built-in joystick, you will need a second analogue stick plugged into one of the 3.5mm expansion ports to handle camera movement.
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
2. Test inputs to verify that pressing each cardinal position registers the correct software button and symbol:
* **East** $\rightarrow$ **Button 1 ($\bigcirc$ / B)**
* **North** $\rightarrow$ **Button 2 ($\triangle$ / Y)**
* **West** $\rightarrow$ **Button 3 ($\square$ / X)**
* **South** $\rightarrow$ **Button 4 ($\times$ / A)**


3. Verify that the **Left Joystick** controls character movement and the **External Right Joystick** controls camera rotation smoothly.