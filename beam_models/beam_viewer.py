from matplotlib import pyplot as plt
import numpy as np
import base64
import io
from matplotlib.figure import Figure
from matplotlib.backends.backend_agg import FigureCanvasAgg as FigureCanvas
import matplotlib

matplotlib.use('Agg')

class BeamViewer:
    """Handles visualization of beam patterns and wave maps"""
    
    def __init__(self):
        self.figure_size = (10, 8)
    
    def generate_wave_map_image(self, wave_map):
        """Generate base64 encoded image of wave map"""
        fig = Figure(figsize=self.figure_size, facecolor='#1E293B')
        ax = fig.add_subplot(111)
        
        # Create colormap similar to original
        cmap = matplotlib.colors.LinearSegmentedColormap.from_list(
            'custom', [(1, 0, 0), (0, 0, 1), (1, 0, 0)]
        )
        
        im = ax.imshow(wave_map, cmap=cmap, aspect='auto', 
                      extent=[-20, 20, 0, 20], origin='lower')
        ax.set_xlabel('X Position', color='white')
        ax.set_ylabel('Y Position', color='white')
        ax.tick_params(colors='white')
        ax.set_facecolor('#1E293B')
        
        # Add colorbar
        cbar = fig.colorbar(im, ax=ax)
        cbar.ax.yaxis.set_tick_params(color='white')
        cbar.outline.set_edgecolor('white')
        plt.setp(cbar.ax.get_yticklabels(), color='white')
        
        # Convert to base64
        buf = io.BytesIO()
        FigureCanvas(fig).print_png(buf)
        data = base64.b64encode(buf.getbuffer()).decode("ascii")
        return f"data:image/png;base64,{data}"
    
    def generate_beam_profile_image(self, angles, response):
        """Generate base64 encoded image of beam profile"""
        fig = Figure(figsize=(6, 6), facecolor='#1E293B')
        ax = fig.add_subplot(111, polar=True)
        
        ax.plot(angles, response, color='b', linewidth=2)
        ax.set_theta_zero_location("N")
        ax.set_theta_direction(-1)
        ax.set_rticks([])
        ax.set_ylim(0, 1)
        ax.set_facecolor('#1E293B')
        ax.tick_params(colors='white')
        ax.grid(color='gray', alpha=0.3)
        
        # Convert to base64
        buf = io.BytesIO()
        FigureCanvas(fig).print_png(buf)
        data = base64.b64encode(buf.getbuffer()).decode("ascii")
        return f"data:image/png;base64,{data}"