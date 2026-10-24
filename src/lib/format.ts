// Pourcentage à la française (« 3,1 % », « +12 % ») ; signed : signe + devant un écart positif
export const pct = (n: number, signed = false) => `${signed && n > 0 ? '+' : ''}${n.toLocaleString('fr-FR')} %`
