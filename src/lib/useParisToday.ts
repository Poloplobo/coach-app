import { useEffect, useState } from 'react'
import { parisDate } from './week'

// Le jour suit l'heure de Paris, même si l'app reste ouverte après minuit
export function useParisToday() {
  const [today, setToday] = useState(parisDate)
  useEffect(() => {
    const id = setInterval(() => setToday(parisDate()), 60_000)
    return () => clearInterval(id)
  }, [])
  return today
}
