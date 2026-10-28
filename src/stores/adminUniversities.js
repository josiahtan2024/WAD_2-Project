import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'
import { useUniversitiesStore } from '@/stores/universities'

const LOGO_BUCKET = 'university-logos'
const MAX_LOGO_BYTES = 2 * 1024 * 1024
const LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const PERIOD_FIELDS = ['period_name', 'term', 'academic_year', 'start_date', 'end_date', 'min_temperature', 'max_temperature', 'description']

function explain(error) {
  if (error.code === '23505' && /universities_name_country/.test(error.message)) {
    return new Error('A university with that name and country already exists.')
  }
  if (error.code === '42501') return new Error('Only admins can do that.')
  return error
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'university'
}

// logo_url is stored as "university-logos/<file>", the bucket path is just the file
function logoFile(logoUrl) {
  return logoUrl?.replace(/^\/?university-logos\//, '')
}

// Keep the lists the rest of the app already loaded in step with what was just saved.
function patchLoaded(id, changes) {
  const item = useUniversitiesStore().items.find((u) => u.id === id)
  if (item) Object.assign(item, changes)
}

export const useAdminUniversitiesStore = defineStore('adminUniversities', {
  state: () => ({ saving: false }),
  actions: {
    // every save goes through here so a double click cannot send two requests
    async run(work) {
      if (this.saving) return
      this.saving = true
      try {
        return await work()
      } catch (error) {
        throw explain(error)
      } finally {
        this.saving = false
      }
    },

    /** New universities start hidden, so they can be filled in before students see them. */
    create(fields) {
      return this.run(async () => {
        const { data, error } = await supabase
          .from('universities')
          .insert({ ...fields, published: false })
          .select('*')
          .single()
        if (error) throw error
        useUniversitiesStore().items.push({ ...data, university_costs: null })
        return data
      })
    },

    /** @param {number} id @param {Object} fields columns of `universities` */
    update(id, fields) {
      return this.run(async () => {
        const { data, error } = await supabase
          .from('universities')
          .update(fields)
          .eq('id', id)
          .select('*')
          .single()
        if (error) throw error
        patchLoaded(id, data)
        return data
      })
    },

    /** Change the basics and, if one is given, swap the logo. */
    updateWithLogo(university, fields, logo) {
      const oldLogo = university.logo_url // the list is patched in place below, so read it now
      return this.run(async () => {
        let newFile = null
        try {
          if (logo) {
            newFile = await this.uploadLogo(fields.name ?? university.name, logo)
            fields = { ...fields, logo_url: `${LOGO_BUCKET}/${newFile}` }
          }
          const { data, error } = await supabase
            .from('universities')
            .update(fields)
            .eq('id', university.id)
            .select('*')
            .single()
          if (error) throw error
          patchLoaded(university.id, data)
        } catch (error) {
          if (newFile) await supabase.storage.from(LOGO_BUCKET).remove([newFile])
          throw error
        }
        await this.removeOldLogo(oldLogo, university.id)
      })
    },

    async uploadLogo(name, file) {
      if (!LOGO_TYPES.includes(file.type)) throw new Error('The logo must be a JPG, PNG or WebP image.')
      if (file.size > MAX_LOGO_BYTES) throw new Error('The logo must be 2 MB or smaller.')
      const path = `${slugify(name)}-${Date.now()}.${file.type.split('/')[1]}`
      const { error } = await supabase.storage.from(LOGO_BUCKET).upload(path, file, { contentType: file.type })
      if (error) throw error
      return path
    },

    // a logo file can be shared by seed data, so only remove it when nobody else uses it
    async removeOldLogo(logoUrl, universityId) {
      const file = logoFile(logoUrl)
      if (!file) return
      const stillUsed = useUniversitiesStore().items.some((u) => u.id !== universityId && logoFile(u.logo_url) === file)
      const current = useUniversitiesStore().items.find((u) => u.id === universityId)
      if (stillUsed || logoFile(current?.logo_url) === file) return
      await supabase.storage.from(LOGO_BUCKET).remove([file])
    },

    /** @param {number} id @param {Object} cost columns of `university_costs` */
    saveCost(id, cost) {
      return this.run(async () => {
        const { data, error } = await supabase
          .from('university_costs')
          .upsert({ ...cost, university_id: id }, { onConflict: 'university_id' })
          .select('*')
          .single()
        if (error) throw error
        patchLoaded(id, { university_costs: data })
      })
    },

    /** @param {number} id @param {string[]} wanted the full list of languages after the edit */
    saveLanguages(id, wanted) {
      return this.run(async () => {
        const { data, error } = await supabase
          .from('university_languages')
          .select('id, instruction_language')
          .eq('university_id', id)
        if (error) throw error

        const gone = data.filter((row) => !wanted.includes(row.instruction_language))
        const added = wanted.filter((name) => !data.some((row) => row.instruction_language === name))

        if (gone.length) {
          const { error: deleteError } = await supabase.from('university_languages').delete().in('id', gone.map((row) => row.id))
          if (deleteError) throw deleteError
        }
        if (added.length) {
          const rows = added.map((name) => ({ university_id: id, instruction_language: name }))
          const { error: insertError } = await supabase.from('university_languages').insert(rows)
          if (insertError) throw insertError
        }
      })
    },

    /** @param {number} id @param {Object[]} rows the full list of periods after the edit, `id` set on existing ones */
    savePeriods(id, rows) {
      return this.run(async () => {
        const { data, error } = await supabase.from('exchange_periods').select('id').eq('university_id', id)
        if (error) throw error

        const keep = rows.filter((row) => row.id).map((row) => row.id)
        const gone = data.filter((row) => !keep.includes(row.id)).map((row) => row.id)
        if (gone.length) {
          const { error: deleteError } = await supabase.from('exchange_periods').delete().in('id', gone)
          if (deleteError) throw deleteError
        }

        for (const row of rows.filter((r) => r.id)) {
          const { error: updateError } = await supabase.from('exchange_periods').update(pick(row, PERIOD_FIELDS)).eq('id', row.id)
          if (updateError) throw updateError
        }

        const fresh = rows.filter((row) => !row.id).map((row) => ({ ...pick(row, PERIOD_FIELDS), university_id: id }))
        if (fresh.length) {
          const { error: insertError } = await supabase.from('exchange_periods').insert(fresh)
          if (insertError) throw insertError
        }
      })
    },

    setPublished(id, published) {
      return this.update(id, { published })
    },

    /** What deleting this university would wipe from students' accounts. */
    async impact(id) {
      const { data, error } = await supabase.rpc('university_impact', { p_university_id: id })
      if (error) throw explain(error)
      return data
    },

    /** Only hidden universities can be deleted, the database enforces that too. */
    remove(university) {
      return this.run(async () => {
        if (university.published !== false) throw new Error('Hide the university before deleting it.')
        const { data, error } = await supabase.from('universities').delete().eq('id', university.id).select('id')
        if (error) throw error
        if (!data?.length) throw new Error('Could not delete that university.')
        const file = logoFile(university.logo_url)
        const shared = useUniversitiesStore().items.some((u) => u.id !== university.id && logoFile(u.logo_url) === file)
        if (file && !shared) await supabase.storage.from(LOGO_BUCKET).remove([file])
      })
    },

    /** Drop a deleted university from the list. Call it after leaving its page, which would otherwise show "not found". */
    forget(id) {
      const loaded = useUniversitiesStore()
      loaded.items = loaded.items.filter((u) => u.id !== id)
    },
  },
})

function pick(row, fields) {
  return Object.fromEntries(fields.map((field) => [field, row[field] ?? null]))
}
