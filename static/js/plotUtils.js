// Plotting utilities
class PlotUtils {

    // ------------------ Interference Map ------------------
    static createInterferenceMap(fieldData, elementId = 'interference-map') {
        if (!fieldData || !fieldData.field) return;

        const trace = {
            z: fieldData.field,
            type: 'heatmap',
            colorscale: 'Jet',
            zmin: -40,
            zmax: 0,
            x0: fieldData.extent[0],
            dx: (fieldData.extent[1] - fieldData.extent[0]) /
                (fieldData.field[0].length - 1),
            y0: fieldData.extent[2],
            dy: (fieldData.extent[3] - fieldData.extent[2]) /
                (fieldData.field.length - 1)
        };

        const layout = {
            title: 'Interference Map',
            xaxis: { title: 'X (m)' },
            yaxis: { title: 'Y (m)', scaleanchor: 'x' },
            width: document.getElementById(elementId).offsetWidth,
            height: document.getElementById(elementId).offsetHeight,
            margin: { t: 40, r: 40, b: 40, l: 40 }
        };

        Plotly.newPlot(elementId, [trace], layout);
    }

    // ------------------ Beam Pattern ------------------
// In plotUtils.js - Update createBeamPattern function
    static createBeamPattern(patternData, elementId = 'beam-pattern') {
        if (!patternData || !patternData.theta || !patternData.pattern) return;

        // Convert radians to degrees and ensure proper orientation
        // Normalize to start from 0° (east/right) and go counterclockwise
        const thetaDeg = patternData.theta.map(rad => {
            // Convert from [-π, π] or [0, 2π] to [0, 360] with 0° at east/right
            let deg = rad * 180 / Math.PI;
            
            // If your calculation returns negative angles, convert to positive
            if (deg < 0) deg += 360;
            
            // Adjust so 0° is at east/right (standard polar plot convention)
            // Some calculations might have 0° at north, so adjust if needed
            deg = (deg + 90) % 360; // Rotate 90° clockwise if 0° is at north
            
            return deg;
        });

        const trace = {
            r: patternData.pattern,   // dB values
            theta: thetaDeg,
            mode: 'lines',
            type: 'scatterpolar',
            fill: 'toself',
            line: { width: 2, color: '#6e8efb' },
            fillcolor: 'rgba(110, 142, 251, 0.3)'
        };

        const layout = {
            title: 'Beam Pattern',
            polar: {
                radialaxis: {
                    visible: true,
                    angle: 0,
                    tickangle: 0,
                    range: [-40, 0],
                    tickfont: { size: 10 },
                    title: 'dB'
                },
                angularaxis: {
                    direction: 'counterclockwise',
                    rotation: 0,
                    tickmode: 'array',
                    tickvals: [0, 90, 180, 270],
                    ticktext: ['0°', '90°', '180°', '270°']
                }
            },
            width: document.getElementById(elementId).offsetWidth,
            height: document.getElementById(elementId).offsetHeight,
            margin: { t: 40, r: 40, b: 40, l: 40 }
        };

        Plotly.newPlot(elementId, [trace], layout);
    }
    // ------------------ Resize ------------------
    static updatePlotSize(elementId) {
        Plotly.Plots.resize(
            document.getElementById(elementId)
        );
    }
}
