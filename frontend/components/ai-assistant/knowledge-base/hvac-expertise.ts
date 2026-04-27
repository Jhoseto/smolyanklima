/**
 * HVAC Expertise Knowledge Base
 * Technical knowledge about HVAC systems for Smolyan Klima
 */

export const HVAC_EXPERTISE = {
  // BTU Calculation Formulas
  btuCalculation: {
    cooling: {
      formula: 'BTU = Square Meters × 500-600',
      examples: [
        '15 m² = 7500-9000 BTU (9000 BTU модел)',
        '20 m² = 10000-12000 BTU (12000 BTU модел)',
        '25 m² = 12500-15000 BTU (12000-18000 BTU модел)',
        '30 m² = 15000-18000 BTU (18000-24000 BTU модел)',
      ],
      factors: [
        'Южна страна = +10% BTU',
        'Високи тавани (3м+) = +20% BTU',
        'Много прозорци = +15% BTU',
        'Изолация = -10% BTU',
      ],
    },
    heating: {
      formula: 'BTU = Square Meters × 100-120',
      examples: [
        '15 m² = 1500-1800 BTU (2000 BTU модел)',
        '20 m² = 2000-2400 BTU (2500 BTU модел)',
        '25 m² = 2500-3000 BTU (3500 BTU модел)',
      ],
    },
  },

  // Technical Specifications Explained
  technicalSpecs: {
    energyClass: {
      'A+++': 'Най-висок клас енергийна ефективност. Спестява 30-50% електричество.',
      'A++': 'Много висока ефективност. Спестява 20-30% електричество.',
      'A+': 'Висока ефективност. Спестява 10-20% електричество.',
      'A': 'Стандартна ефективност.',
    },
    noiseLevels: {
      quiet: '19-25 dB - По-тихо от шепот, идеално за спалня',
      normal: '26-35 dB - Нормален разговор',
      loud: '36-45 dB - Градусен телевизор',
    },
    seerRating: {
      explanation: 'SEER = Seasonal Energy Efficiency Ratio (Коефициент на сезонна енергийна ефективност)',
      good: 'SEER 6.0-7.0 = Добър клас',
      better: 'SEER 8.0-9.0 = Много добър клас',
      best: 'SEER 10.0+ = Най-добър клас',
    },
  },

  // Installation Requirements
  installation: {
    outdoorUnit: {
      minDistance: '50 см от стена',
      minClearance: '1 м от всички страни',
      drainage: 'Трябва дренаж за кондензата',
      shade: 'Не на пряко слънце',
    },
    indoorUnit: {
      height: '2.5-2.7 м от пода',
      distance: '3-5 м от външното тяло',
      accessibility: 'Достъп за поддръжка',
    },
    piping: {
      material: 'Медни тръби с изолация',
      length: 'Обикновено 5-15 м',
      insulation: '10-20 mm армирована изолация',
    },
    electrical: {
      voltage: '220V, 50Hz',
      breaker: '16A-20A автомат',
      grounding: 'Задължително заземяване',
    },
  },

  // Maintenance Schedule
  maintenance: {
    filters: {
      frequency: 'На всеки 3-6 месеца',
      cleaning: 'Почистване с топла вода и мек сапун',
      replacement: 'Препоръчва се замена годишно',
    },
    outdoorUnit: {
      cleaning: 'Пролет - почистване на радиатор и перки',
      inspection: 'Есен - проверка на дренаж и електричество',
    },
    refrigerant: {
      check: 'Годишно - проверка за течове',
      refill: 'Само при необходимост (тече)',
    },
  },

  // Common Problems & Solutions
  troubleshooting: {
    notCooling: [
      'Провери дали е зададен охлаждащ режим',
      'Провери дали филтрите са чисти',
      'Провери дали външното тяло има достъп до въздух',
      'Провери дали дренажът е запушен',
    ],
    noisy: [
      'Нормално е леко бръмчене при стартиране/спиране',
      'Ако е постоянно шумно - обади техник',
      'Вибрация може да е от неправилен монтаж',
    ],
    leaking: [
      'Провери дали дренажната тръба е запушена',
      'Провери дали дренажът е изправен',
      'Ако течи от вътрешното тяло - обади техник',
    ],
    freezing: [
      'Провери дали филтрите са чисти',
      'Провери дали вентилаторът работи',
      'Може да е ниско ниво на фреон',
    ],
  },

  // Regional Specifics (Smolyan Region)
  regional: {
    climate: {
      summer: '25-35°C през деня, 15-20°C през нощта',
      winter: '-5 до 5°C през деня, -15 до -5°C през ноща',
      humidity: 'Средна до висока',
    },
    recommendations: {
      summer: 'Препоръчваме по-мощни модели за летните горещини',
      winter: 'Инверторните климатици са по-ефективни за отопление',
      altitude: 'Смолян е на 1000+ м надморска височина - моделите са пригодени',
    },
  },

  // Warranty Information
  warranty: {
    daikin: {
      standard: '36 месеца',
      compressor: '5 години',
      conditions: 'Професионален монтаж, годишна профилактика',
    },
    mitsubishi: {
      standard: '36 месеца',
      compressor: '5 години',
      conditions: 'Професионален монтаж, годишна профилактика',
    },
    toshiba: {
      standard: '24 месеца',
      compressor: '3 години',
      conditions: 'Професионален монтаж',
    },
    gree: {
      standard: '24 месеца',
      compressor: '3 години',
      conditions: 'Професионален монтаж',
    },
  },

  // Energy Savings Calculator
  energySavings: {
    oldVsNew: {
      explanation: 'Старите климатици (10+ години) консумират 2-3 пъти повече',
      savings: 'С инверторен климатик спестявате 30-50% на сметката за ток',
      payback: 'Инвестицията се изплаща за 2-4 години',
    },
    example: {
      oldAC: 'Стар климатик 12000 BTU = 150 лв/месец ток',
      newAC: 'Нов инверторен 12000 BTU = 80 лв/месец ток',
      savings: '70 лв/месец = 840 лв/година',
    },
  },

  // Brand Comparisons
  brandComparison: {
    daikin: {
      strengths: ['Най-високо качество', 'Тиха работа', 'Дълга гарантия'],
      bestFor: 'Клиенти които ценят качество над цена',
      priceRange: 'Висока',
    },
    mitsubishi: {
      strengths: ['Надеждност', 'Технологични иновации', 'Тиха работа'],
      bestFor: 'Технически ориентирани клиенти',
      priceRange: 'Висока',
    },
    toshiba: {
      strengths: ['Добро съотношение цена/качество', 'Надеждност'],
      bestFor: 'Бюджетно ориентирани клиенти',
      priceRange: 'Средна',
    },
    gree: {
      strengths: ['Най-добра цена', 'Инвертор технология', 'Добро качество'],
      bestFor: 'Клиенти с ограничен бюджет',
      priceRange: 'Ниска',
    },
  },

  // Smart Features
  smartFeatures: {
    wifi: {
      description: 'Wi-Fi модул за управление през приложение',
      benefits: ['Контрол от разстояние', 'Программиране', 'Енергоспестяване'],
      apps: ['Daikin Residential Controller', 'MELCloud (Mitsubishi)', 'SmartAir (Toshiba)'],
    },
    inverter: {
      description: 'Инверторна технология за плавно регулиране',
      benefits: ['Тиха работа', 'Енергоспестяване', 'По-дълъг живот'],
    },
    plasma: {
      description: 'Plasma ionizer за пречистване на въздуха',
      benefits: ['Унищожава бактерии', 'Премахва миризми', 'Алергенни филтър'],
    },
  },
};

export default HVAC_EXPERTISE;
