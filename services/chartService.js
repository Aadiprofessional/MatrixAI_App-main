import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  RadialLinearScale,
  Filler
} from 'chart.js';
import { evaluate } from 'mathjs';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  RadialLinearScale,
  Filler
);

class ChartService {
  constructor() {
    this.defaultColors = {
      light: {
        primary: '#007AFF',
        secondary: '#34C759',
        tertiary: '#FF9500',
        quaternary: '#FF3B30',
        background: '#FFFFFF',
        text: '#000000',
        grid: '#E5E5E7'
      },
      dark: {
        primary: '#0A84FF',
        secondary: '#30D158',
        tertiary: '#FF9F0A',
        quaternary: '#FF453A',
        background: '#1C1C1E',
        text: '#FFFFFF',
        grid: '#38383A'
      }
    };
    
    // Storage for chart configurations
    this.chartStorage = new Map();
  }

  // Store chart configuration by ID
  storeChart(chartId, config) {
    console.log('📊 [DEBUG] Storing chart:', chartId, config);
    this.chartStorage.set(chartId, config);
  }

  // Retrieve chart configuration by ID
  getChart(chartId) {
    console.log('📊 [DEBUG] Retrieving chart:', chartId);
    const config = this.chartStorage.get(chartId);
    console.log('📊 [DEBUG] Retrieved config:', config);
    return config;
  }

  // Clear chart storage
  clearCharts() {
    this.chartStorage.clear();
  }

  // Get color palette based on theme
  getColorPalette(isDarkMode = false) {
    return isDarkMode ? this.defaultColors.dark : this.defaultColors.light;
  }

  // Generate color array for datasets
  generateColors(count, isDarkMode = false) {
    const palette = this.getColorPalette(isDarkMode);
    const baseColors = [
      palette.primary,
      palette.secondary,
      palette.tertiary,
      palette.quaternary,
      '#8E8E93',
      '#AF52DE',
      '#FF2D92',
      '#5AC8FA'
    ];

    const colors = [];
    for (let i = 0; i < count; i++) {
      colors.push(baseColors[i % baseColors.length]);
    }
    return colors;
  }

  // Apply theme to chart configuration
  applyTheme(config, isDarkMode = false) {
    const palette = this.getColorPalette(isDarkMode);
    
    // Apply theme to chart options
    if (!config.options) config.options = {};
    if (!config.options.plugins) config.options.plugins = {};
    if (!config.options.scales) config.options.scales = {};

    // Set background and text colors
    config.options.plugins.legend = {
      ...config.options.plugins.legend,
      labels: {
        ...config.options.plugins.legend?.labels,
        color: palette.text
      }
    };

    config.options.plugins.title = {
      ...config.options.plugins.title,
      color: palette.text
    };

    // Apply grid and axis colors
    const scaleDefaults = {
      grid: {
        color: palette.grid
      },
      ticks: {
        color: palette.text
      }
    };

    if (config.options.scales.x) {
      config.options.scales.x = { ...config.options.scales.x, ...scaleDefaults };
    }
    if (config.options.scales.y) {
      config.options.scales.y = { ...config.options.scales.y, ...scaleDefaults };
    }

    // Apply colors to datasets
    if (config.data && config.data.datasets) {
      const colors = this.generateColors(config.data.datasets.length, isDarkMode);
      
      config.data.datasets.forEach((dataset, index) => {
        const color = colors[index];
        
        switch (config.type) {
          case 'line':
            dataset.borderColor = color;
            dataset.backgroundColor = color + '20'; // Add transparency
            break;
          case 'bar':
            dataset.backgroundColor = color;
            dataset.borderColor = color;
            break;
          case 'pie':
          case 'doughnut':
            if (!dataset.backgroundColor) {
              dataset.backgroundColor = colors;
            }
            break;
          default:
            dataset.backgroundColor = color;
            dataset.borderColor = color;
        }
      });
    }

    return config;
  }

  // Handle Chart.js v2 to v3+ migration
  migrateChartConfig(config) {
    // Clone config to avoid mutations
    const migratedConfig = JSON.parse(JSON.stringify(config));

    // Migrate scales configuration
    if (migratedConfig.options && migratedConfig.options.scales) {
      const scales = migratedConfig.options.scales;
      
      // Convert v2 scales to v3 format
      if (scales.xAxes || scales.yAxes) {
        const newScales = {};
        
        if (scales.xAxes && scales.xAxes[0]) {
          newScales.x = scales.xAxes[0];
        }
        if (scales.yAxes && scales.yAxes[0]) {
          newScales.y = scales.yAxes[0];
        }
        
        migratedConfig.options.scales = newScales;
      }
    }

    // Migrate tooltips configuration
    if (migratedConfig.options && migratedConfig.options.tooltips) {
      migratedConfig.options.plugins = migratedConfig.options.plugins || {};
      migratedConfig.options.plugins.tooltip = migratedConfig.options.tooltips;
      delete migratedConfig.options.tooltips;
    }

    return migratedConfig;
  }

  // Generate mathematical function chart
  generateMathChart(equation, xMin = -10, xMax = 10, steps = 100, isDarkMode = false) {
    try {
      const xValues = [];
      const yValues = [];
      const step = (xMax - xMin) / steps;

      for (let x = xMin; x <= xMax; x += step) {
        try {
          const y = evaluate(equation, { x });
          if (typeof y === 'number' && isFinite(y)) {
            xValues.push(x);
            yValues.push(y);
          }
        } catch (error) {
          // Skip invalid points
          continue;
        }
      }

      const config = {
        type: 'line',
        data: {
          labels: xValues.map(x => x.toFixed(2)),
          datasets: [{
            label: `f(x) = ${equation}`,
            data: yValues,
            fill: false,
            tension: 0.1
          }]
        },
        options: {
          responsive: true,
          plugins: {
            title: {
              display: true,
              text: `Mathematical Function: f(x) = ${equation}`
            }
          },
          scales: {
            x: {
              title: {
                display: true,
                text: 'x'
              }
            },
            y: {
              title: {
                display: true,
                text: 'f(x)'
              }
            }
          }
        }
      };

      return this.applyTheme(config, isDarkMode);
    } catch (error) {
      console.error('Error generating math chart:', error);
      return null;
    }
  }

  // Process text and extract chart configurations
  processTextWithCharts(text, isDarkMode = false) {
    console.log('🔍 [DEBUG] processTextWithCharts called with text length:', text?.length);
    console.log('🔍 [DEBUG] Input text preview:', text?.substring(0, 200) + '...');
    
    const chartRegex = /```chartjs\s*([\s\S]*?)```/g;
    const charts = [];
    let processedText = text;
    let match;
    let matchCount = 0;

    console.log('🔍 [DEBUG] Looking for chartjs blocks with regex:', chartRegex);

    while ((match = chartRegex.exec(text)) !== null) {
      matchCount++;
      console.log(`🔍 [DEBUG] Found chart match #${matchCount}:`, match[0].substring(0, 100) + '...');
      
      try {
        const chartConfigStr = match[1].trim();
        console.log('🔍 [DEBUG] Chart config string:', chartConfigStr);
        
        // Check if chartConfigStr is empty or undefined
        if (!chartConfigStr || chartConfigStr === 'undefined' || chartConfigStr === '') {
          console.error('🔍 [DEBUG] Empty or undefined chart config string, skipping chart');
          continue;
        }
        
        let chartConfig = JSON.parse(chartConfigStr);
        console.log('🔍 [DEBUG] Parsed chart config:', chartConfig);
        
        // Migrate and apply theme
        chartConfig = this.migrateChartConfig(chartConfig);
        chartConfig = this.applyTheme(chartConfig, isDarkMode);
        
        // Generate unique ID for chart
        const chartId = `chart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        console.log('🔍 [DEBUG] Generated chart ID:', chartId);
        
        // Store chart configuration
        this.storeChart(chartId, chartConfig);
        
        charts.push({
          id: chartId,
          config: chartConfig,
          originalText: match[0]
        });

        // Replace chart code block with placeholder
        processedText = processedText.replace(match[0], `[CHART:${chartId}]`);
        console.log('🔍 [DEBUG] Replaced chart with placeholder:', `[CHART:${chartId}]`);
      } catch (error) {
        console.error('❌ [DEBUG] Error parsing chart configuration:', error);
        console.error('❌ [DEBUG] Failed chart config string:', match[1]);
        // Keep original text if parsing fails
      }
    }

    console.log('🔍 [DEBUG] Total charts found:', charts.length);
    console.log('🔍 [DEBUG] Final processed text preview:', processedText.substring(0, 200) + '...');

    return {
      text: processedText,
      charts: charts
    };
  }

  // Validate chart configuration
  validateChartConfig(config) {
    const supportedTypes = ['line', 'bar', 'pie', 'doughnut', 'scatter', 'bubble', 'polarArea', 'radar'];
    
    if (!config.type || !supportedTypes.includes(config.type)) {
      return { valid: false, error: 'Invalid or unsupported chart type' };
    }

    if (!config.data || !config.data.datasets || config.data.datasets.length === 0) {
      return { valid: false, error: 'Chart data is missing or invalid' };
    }

    return { valid: true };
  }

  // Get chart download configuration
  getDownloadConfig(isDarkMode = false) {
    const palette = this.getColorPalette(isDarkMode);
    
    return {
      backgroundColor: palette.background,
      pixelRatio: 2, // Higher resolution
      plugins: {
        beforeDraw: (chart) => {
          const ctx = chart.canvas.getContext('2d');
          ctx.save();
          ctx.globalCompositeOperation = 'destination-over';
          ctx.fillStyle = palette.background;
          ctx.fillRect(0, 0, chart.canvas.width, chart.canvas.height);
          ctx.restore();
        }
      }
    };
  }
}

export default new ChartService();