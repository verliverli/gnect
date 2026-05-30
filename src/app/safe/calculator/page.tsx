'use client'

import { useState } from 'react'

// ============================================
// SAFE CALCULATOR PAGE — Fake calculator for panic redirect
// Looks like a real calculator to protect user privacy
// ============================================

export default function CalculatorPage() {
  const [display, setDisplay] = useState('0')
  const [prev, setPrev] = useState<number | null>(null)
  const [op, setOp] = useState<string | null>(null)
  const [newNumber, setNewNumber] = useState(true)

  const input = (n: string) => {
    if (newNumber) {
      setDisplay(n)
      setNewNumber(false)
    } else {
      setDisplay(display === '0' ? n : display + n)
    }
  }

  const operate = (nextOp: string) => {
    const current = parseFloat(display)
    if (prev !== null && op && !newNumber) {
      let result = prev
      if (op === '+') result = prev + current
      else if (op === '−') result = prev - current
      else if (op === '×') result = prev * current
      else if (op === '÷') result = current !== 0 ? prev / current : 0
      setDisplay(String(result))
      setPrev(result)
    } else {
      setPrev(current)
    }
    setOp(nextOp)
    setNewNumber(true)
  }

  const equals = () => {
    if (prev !== null && op) {
      operate('=')
      setOp(null)
    }
  }

  const clear = () => {
    setDisplay('0')
    setPrev(null)
    setOp(null)
    setNewNumber(true)
  }

  const percent = () => {
    setDisplay(String(parseFloat(display) / 100))
  }

  const toggleSign = () => {
    setDisplay(String(-parseFloat(display)))
  }

  const decimal = () => {
    if (!display.includes('.')) {
      setDisplay(display + '.')
      setNewNumber(false)
    }
  }

  const btnClass = (type: 'num' | 'op' | 'fn') => {
    const base = 'h-16 rounded-full text-xl font-medium active:opacity-70 transition-opacity flex items-center justify-center'
    if (type === 'op') return `${base} bg-orange-500 text-white`
    if (type === 'fn') return `${base} bg-gray-400 text-black`
    return `${base} bg-gray-600 text-white`
  }

  return (
    <div className="min-h-screen bg-black flex flex-col justify-end p-4 max-w-md mx-auto">
      {/* Display */}
      <div className="flex-1 flex items-end justify-end px-4 pb-4">
        <span className="text-white text-6xl font-light truncate">
          {display.length > 12 ? parseFloat(display).toExponential(5) : display}
        </span>
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-4 gap-3">
        <button className={btnClass('fn')} onClick={clear}>C</button>
        <button className={btnClass('fn')} onClick={toggleSign}>±</button>
        <button className={btnClass('fn')} onClick={percent}>%</button>
        <button className={btnClass('op')} onClick={() => operate('÷')}>÷</button>

        <button className={btnClass('num')} onClick={() => input('7')}>7</button>
        <button className={btnClass('num')} onClick={() => input('8')}>8</button>
        <button className={btnClass('num')} onClick={() => input('9')}>9</button>
        <button className={btnClass('op')} onClick={() => operate('×')}>×</button>

        <button className={btnClass('num')} onClick={() => input('4')}>4</button>
        <button className={btnClass('num')} onClick={() => input('5')}>5</button>
        <button className={btnClass('num')} onClick={() => input('6')}>6</button>
        <button className={btnClass('op')} onClick={() => operate('−')}>−</button>

        <button className={btnClass('num')} onClick={() => input('1')}>1</button>
        <button className={btnClass('num')} onClick={() => input('2')}>2</button>
        <button className={btnClass('num')} onClick={() => input('3')}>3</button>
        <button className={btnClass('op')} onClick={() => operate('+')}>+</button>

        <button className={`${btnClass('num')} col-span-2`} onClick={() => input('0')}>0</button>
        <button className={btnClass('num')} onClick={decimal}>.</button>
        <button className={btnClass('op')} onClick={equals}>=</button>
      </div>
    </div>
  )
}
