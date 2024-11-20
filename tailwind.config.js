module.exports = {
  theme: {
    extend: {
      animation: {
        'shimmer': 'shimmer 2s infinite',
        'rocket-launch': 'rocket-launch 2s cubic-bezier(0.4, 0, 0.2, 1) forwards'
      },
      keyframes: {
        'rocket-launch': {
          '0%': { 
            transform: 'translate(0, 0) rotate(-30deg) scale(1)',
            opacity: '0'
          },
          '20%': {
            transform: 'translate(0, 0) rotate(-30deg) scale(1)',
            opacity: '1'
          },
          '40%': { 
            transform: 'translate(20px, -20px) rotate(-30deg) scale(1.2)',
            opacity: '1'
          },
          '100%': { 
            transform: 'translate(100px, -500px) rotate(-30deg) scale(0.8)',
            opacity: '0'
          }
        }
      }
    }
  }
} 