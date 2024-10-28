import React from 'react';

interface Args {
  id: string;
  title: string;
}

export const FilterToolbarDataTableContext = React.createContext<Args>({
  id: '',
  title: '',
});

export const useFilterToolbarDataTable = () =>
  React.useContext(FilterToolbarDataTableContext);
