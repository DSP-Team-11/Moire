<div align="center">

# 🌊MOIRÉ: Fourier Transform Mixer & Beamforming Simulator

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.8+-blue.svg" alt="Python">
  <img src="https://img.shields.io/badge/Flask-2.0+-green.svg" alt="Flask">
  <img src="https://img.shields.io/badge/NumPy-Latest-orange.svg" alt="NumPy">
  <img src="https://img.shields.io/badge/OpenCV-Latest-red.svg" alt="OpenCV">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License">
</p>

<p align="center">
  <strong>A powerful web application for advanced image processing using Fourier Transform techniques and real-time phased array beamforming simulation</strong>
</p>

<p align="center">
  <em>Transform • Analyze • Visualize • Simulate</em>
</p>

---

</div>

## 📺 See It In Action

<table>
<tr>
<td width="50%">

### 🎨 Fourier Transform Mixer
Watch real-time image processing with component visualization and region-based mixing

https://github.com/user-attachments/assets/04e974bf-60c3-464b-852f-e8f8f9e794a5

</td>
<td width="50%">

### 📡 Beamforming Simulator
Experience dynamic phased array beamforming with instant parameter control

https://github.com/user-attachments/assets/bcbd5a3d-fc90-440e-aa7e-b80d14b0de8f

</td>
</tr>
</table>

---

## ✨ Features at a Glance

<table>
<tr>
<td width="50%" valign="top">

### 🎨 **Fourier Transform Mixer**

#### Image Processing
- 🖼️ **4 Simultaneous Inputs** - Upload multiple images at once
- 🔄 **Dual Component Modes** - Magnitude/Phase or Real/Imaginary
- 🎯 **Smart Region Control** - Define custom mixing regions
- 👁️ **Real-time Visualization** - All frequency domain components
- 🎛️ **Interactive Controls** - Brightness/contrast on the fly

#### Advanced Capabilities
- ⚡ **Async Processing** - Non-blocking background operations
- 📊 **Progress Tracking** - Real-time mixing status
- 🎯 **Dual Outputs** - Compare multiple results
- 🖱️ **Drag-to-Adjust** - Intuitive image enhancement

</td>
<td width="50%" valign="top">

### 📡 **Beamforming Simulator**

#### Array Configuration
- 📏 **Multiple Geometries** - Linear & Curvilinear arrays
- 🔧 **Dynamic Parameters** - Frequency, phase, spacing
- ➕ **Scalable Arrays** - Add/remove transmitters on demand
- 🎚️ **Precise Control** - Fine-tune all parameters

#### Visualization
- 🌊 **Wave Maps** - 2D interference patterns
- 📊 **Beam Profiles** - Polar radiation patterns
- 🎭 **Pre-configured Scenarios** - Industry applications
- ⚡ **Real-time Updates** - Instant visual feedback

</td>
</tr>
</table>

---

## 🏗️ Architecture Overview

<div align="center">

```
┌─────────────────────────────────────────────────────────────┐
│                     Flask Web Application                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │  FT Mixer Core   │         │  Beamforming     │          │
│  ├──────────────────┤         ├──────────────────┤          │
│  │ • ImageModel     │         │ • PhasedArray    │          │
│  │ • ImageManager   │         │ • Transmitter    │          │
│  │ • UnifiedMixer   │         │ • BeamViewer     │          │
│  │ • MixingWorker   │         │ • Geometry       │          │
│  └──────────────────┘         └──────────────────┘          │
│           │                            │                     │
│           └────────────┬───────────────┘                     │
│                        │                                     │
│                  ┌─────▼─────┐                               │
│                  │  Routes   │                               │
│                  │  (API)    │                               │
│                  └─────┬─────┘                               │
│                        │                                     │
└────────────────────────┼─────────────────────────────────────┘
                         │
              ┌──────────▼──────────┐
              │   JavaScript UI     │
              ├─────────────────────┤
              │ • AppState          │
              │ • RegionManager     │
              │ • MixingManager     │
              │ • BeamFormingApp    │
              └─────────────────────┘
```

</div>

### 🎯 Design Patterns

| Pattern | Usage | Benefit |
|---------|-------|---------|
| **Strategy** | Array geometry switching | Flexible beamforming configurations |
| **Singleton** | State management | Centralized application state |
| **Worker Thread** | Async processing | Non-blocking UI operations |
| **Observer** | Progress updates | Real-time status feedback |

---

## 🚀 Quick Start

### Prerequisites

```bash
Python 3.8+
pip package manager
Modern web browser (Chrome, Firefox, Safari)
```

### Installation

<table>
<tr>
<td>

**1️⃣ Clone Repository**
```bash
git clone <repository-url>
cd project
```

</td>
<td>

**2️⃣ Install Dependencies**
```bash
pip install flask numpy opencv-python \
    matplotlib pillow
```

</td>
<td>

**3️⃣ Launch Application**
```bash
python app.py
```

</td>
</tr>
</table>

### Access Points

<div align="center">

| Module | URL | Description |
|--------|-----|-------------|
| 🏠 **Home** | `http://localhost:5000/` | Landing page |
| 🎨 **FT Mixer** | `http://localhost:5000/ft-mixer` | Image processing interface |
| 📡 **Beamforming** | `http://localhost:5000/beamforming` | Array simulator |

</div>

---

## 📖 Usage Guide

### 🎨 Fourier Transform Mixer

<details>
<summary><strong>📥 Basic Workflow</strong></summary>

1. **Upload** - Click any of the 4 input slots
2. **Configure** - Choose mixing mode (Magnitude/Phase or Real/Imaginary)
3. **Adjust** - Set component weights using sliders
4. **Process** - Click "Mix Images"
5. **Visualize** - Monitor progress and view results

</details>

<details>
<summary><strong>🎯 Region Mode</strong></summary>

Enable advanced spatial control:
- **Toggle** - Switch to region mode
- **Draw** - Click and drag to define regions
- **Configure** - Choose inner/outer selection
- **Reposition** - Drag rectangles to adjust
- **Mix** - Apply region-masked mixing

</details>

<details>
<summary><strong>🎛️ Pro Tips</strong></summary>

- **Brightness/Contrast**: Click + drag on images (↕️ brightness, ↔️ contrast)
- **Component Views**: Switch visualizations with dropdowns
- **Multiple Outputs**: Use different ports for comparison
- **Weight Presets**: Reset buttons restore default values

</details>

### 📡 Beamforming Simulator

<details>
<summary><strong>🎚️ Parameter Controls</strong></summary>

| Parameter | Range | Effect |
|-----------|-------|--------|
| **Frequency** | 0.1 - 10 Hz | Wavelength adjustment |
| **Phase Shift** | 0 - 2π | Beam steering |
| **Distance** | Variable | Element spacing |
| **Radius** | Variable | Array curvature |

</details>

<details>
<summary><strong>🎭 Pre-configured Scenarios</strong></summary>

| Scenario | Elements | Geometry | Application |
|----------|----------|----------|-------------|
| **Tumor Ablation** | 16 | Curvilinear | Focused ultrasound therapy |
| **Ultrasound** | 4 | Linear | Medical imaging |
| **5G mmWave** | 32 | Linear | High-frequency beamforming |

</details>

---

<div align="center">

### 💫 Built with Passion

**Made with ❤️ using Python, Flask, NumPy, OpenCV & Matplotlib**

<p>
  <sub>If this project helped you, please consider giving it a ⭐</sub>
</p>

<p>
  <a href="#-fourier-transform-mixer--beamforming-simulator">Back to Top ⬆️</a>
</p>

</div>
