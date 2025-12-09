export const useSelectedPerson = () => {
  const selectedPersonId = useState<number | null>('selectedPersonId', () => {
    // Load from localStorage on client-side initialization
    if (import.meta.client) {
      try {
        const stored = localStorage.getItem('selectedPersonId')
        if (stored) {
          return parseInt(stored)
        }
      }
      catch (error) {
        console.error('Failed to read from localStorage:', error)
      }
    }
    return null
  })

  const selectedPerson = useState<{ id: number; name: string } | null>('selectedPerson', () => null)

  const setSelectedPerson = (person: { id: number; name: string } | null) => {
    selectedPerson.value = person
    selectedPersonId.value = person?.id || null
    if (import.meta.client) {
      if (person) {
        localStorage.setItem('selectedPersonId', person.id.toString())
      } else {
        localStorage.removeItem('selectedPersonId')
      }
    }
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
    loadSelectedPerson
  }
}

