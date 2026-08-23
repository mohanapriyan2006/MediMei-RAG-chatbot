import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import type { ComparisonResult, SavedComparison } from '../types/comparison'

const STORAGE_KEY = 'medimei_saved_comparisons_v1'

export function useSavedComparisons() {
  const [savedList, setSavedList] = useState<SavedComparison[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        return JSON.parse(stored) as SavedComparison[]
      }
    } catch {
      // fallback
    }
    return []
  })

  // Persist whenever savedList changes
  const persist = useCallback((nextList: SavedComparison[]) => {
    setSavedList(nextList)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList))
    } catch (e) {
      console.error('Failed to save to localStorage:', e)
    }
  }, [])

  // Sync across storage events
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          setSavedList(JSON.parse(e.newValue))
        } catch {
          // ignore
        }
      }
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  const isSaved = useCallback(
    (drug1Id: string, drug2Id: string): boolean => {
      return savedList.some(
        (item) =>
          (item.drug1Id === drug1Id && item.drug2Id === drug2Id) ||
          (item.drug1Id === drug2Id && item.drug2Id === drug1Id),
      )
    },
    [savedList],
  )

  const getSavedByDrugs = useCallback(
    (drug1Id: string, drug2Id: string): SavedComparison | undefined => {
      return savedList.find(
        (item) =>
          (item.drug1Id === drug1Id && item.drug2Id === drug2Id) ||
          (item.drug1Id === drug2Id && item.drug2Id === drug1Id),
      )
    },
    [savedList],
  )

  const saveComparison = useCallback(
    (result: ComparisonResult, customTitle?: string): SavedComparison => {
      const existing = getSavedByDrugs(result.drug1.id, result.drug2.id)
      const title =
        customTitle?.trim() ||
        existing?.title ||
        `${result.drug1.name} vs ${result.drug2.name} Comparison`

      const newEntry: SavedComparison = {
        id: existing ? existing.id : `comp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        title,
        drug1Id: result.drug1.id,
        drug2Id: result.drug2.id,
        drug1Name: result.drug1.name,
        drug2Name: result.drug2.name,
        savedAt: new Date().toISOString(),
        result,
      }

      const filtered = savedList.filter((item) => item.id !== newEntry.id)
      const nextList = [newEntry, ...filtered]
      persist(nextList)

      toast.success('Comparison saved to your library', {
        description: title,
      })

      return newEntry
    },
    [savedList, getSavedByDrugs, persist],
  )

  const updateTitle = useCallback(
    (id: string, newTitle: string, newNotes?: string) => {
      if (!newTitle.trim()) {
        toast.error('Title cannot be empty')
        return
      }

      const nextList = savedList.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            title: newTitle.trim(),
            notes: newNotes !== undefined ? newNotes : item.notes,
          }
        }
        return item
      })

      persist(nextList)
      toast.success('Comparison updated')
    },
    [savedList, persist],
  )

  const deleteComparison = useCallback(
    (id: string) => {
      const itemToDelete = savedList.find((item) => item.id === id)
      const nextList = savedList.filter((item) => item.id !== id)
      persist(nextList)

      toast.success('Comparison removed from library', {
        description: itemToDelete?.title,
      })
    },
    [savedList, persist],
  )

  return {
    savedList,
    saveComparison,
    updateTitle,
    deleteComparison,
    isSaved,
    getSavedByDrugs,
  }
}

export default useSavedComparisons
