import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0B0F19',
          surface: '#111827',
          elevated: '#151D2E',
          border: '#1F2937',
        },
        brand: {
          primary: '#6366F1',
          secondary: '#8B5CF6',
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
          900: '#1E1B4B',
        },
        status: {
          success: '#10B981',
          warning: '#F59E0B',
          danger: '#EF4444',
          info: '#06B6D4',
        },
      },
    },
  },
  plugins: [],
};

export default config;
