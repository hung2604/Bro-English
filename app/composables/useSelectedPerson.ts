export const useSelectedPerson = () => {
  // Use cookie instead of localStorage - automatically syncs between client and server
  const selectedPersonIdCookie = useCookie<number | null>('selectedPersonId', {
    default: () => null,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: false, // Need to access from client-side
  })

  const selectedPerson = useState<{ id: number; name: string } | null>('selectedPerson', () => null)

  // Convert cookie value to number | null and make it reactive
  const selectedPersonId = computed<number | null>({
    get: () => {
      const value = selectedPersonIdCookie.value
      if (value === null || value === undefined) return null
      const num = typeof value === 'number' ? value : parseInt(String(value), 10)
      return isNaN(num) ? null : num
    },
    set: (val: number | null) => {
      selectedPersonIdCookie.value = val
    },
  })

  const setSelectedPerson = (person: { id: number; name: string } | null) => {
    selectedPerson.value = person
    selectedPersonId.value = person?.id || null
  }

  const loadSelectedPerson = async () => {
    if (!selectedPersonId.value) return

    try {
      const persons = await $fetch<Array<{ id: number; name: string }>>('/api/persons')
      const person = persons.find(p => p.id === selectedPersonId.value)
      if (person) {
        selectedPerson.value = person
      } else {
        setSelectedPerson(null)
      }
    } catch (error) {
      console.error('Failed to load selected person:', error)
      setSelectedPerson(null)
    }
  }

  return {
    selectedPersonId: readonly(selectedPersonId),
    selectedPerson: readonly(selectedPerson),
    setSelectedPerson,
    loadSelectedPerson,
  }
}

