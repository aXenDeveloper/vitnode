import { useFetchSearch } from 'fumadocs-core/search/client'
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
  type SharedProps,
} from 'fumadocs-ui/components/dialog/search'

import { DOCS_SEARCH_PATH } from './shared'

const DocsSearchDialog = (props: SharedProps) => {
  const { data, isLoading, onSearchChange, search } = useFetchSearch({
    api: DOCS_SEARCH_PATH,
  })

  return (
    <SearchDialog
      isLoading={isLoading}
      onSearchChange={onSearchChange}
      search={search}
      {...props}
    >
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList items={data?.items ?? null} />
      </SearchDialogContent>
    </SearchDialog>
  )
}

export default DocsSearchDialog
