export function calculateMonthlyCost(cost) {
  if (!cost) return null

  return (
    Number(cost.accommodation ?? 0) +
    Number(cost.food ?? 0) +
    Number(cost.transport ?? 0) +
    Number(cost.personal_expenses ?? 0)
  )
}