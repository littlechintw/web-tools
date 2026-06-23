import type { ToolMeta, ToolMessages } from '@/types'

export const meta: ToolMeta = {
  id: 'unit-convert',
  route: 'unit-convert',
  category: 'convert',
  icon: 'mdi-ruler',
  title: { 'zh-TW': '單位換算', en: 'Unit Converter' },
  description: {
    'zh-TW': '長度、質量、溫度、資料量、面積、體積、速度與時間的單位換算。',
    en: 'Convert length, mass, temperature, data size, area, volume, speed and time.',
  },
  keywords: ['unit', 'convert', '單位', '換算', 'length', 'mass', 'temperature', 'speed'],
}

export const messages: ToolMessages = {
  'zh-TW': {
    category: '類別',
    fromUnit: '從',
    toUnit: '到',
    value: '數值',
    result: '結果',
    catLength: '長度',
    catMass: '質量',
    catTemperature: '溫度',
    catData: '資料量',
    catArea: '面積',
    catVolume: '體積',
    catSpeed: '速度',
    catTime: '時間',
  },
  en: {
    category: 'Category',
    fromUnit: 'From',
    toUnit: 'To',
    value: 'Value',
    result: 'Result',
    catLength: 'Length',
    catMass: 'Mass',
    catTemperature: 'Temperature',
    catData: 'Data size',
    catArea: 'Area',
    catVolume: 'Volume',
    catSpeed: 'Speed',
    catTime: 'Time',
  },
}
