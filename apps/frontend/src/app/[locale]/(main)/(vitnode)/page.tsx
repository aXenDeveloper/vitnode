// ! DO NOT TOUCH THIS FILE!!!
// ! If you remove this then default page plugin will not work
import React from 'react';
import { getSessionData } from 'vitnode-frontend/api/get-session-data';
// import { generateMetadataDefaultPage } from 'vitnode-frontend/views/theme/views/default-page';

// export const generateMetadata = generateMetadataDefaultPage;

export default async function Page() {
  const { plugin_code_default } = await getSessionData();

  const PageFromTheme = React.lazy(async () =>
    import(`@/plugins/${plugin_code_default}/templates/default-page`).then(
      module => ({
        default: module.default,
      }),
    ),
  );

  return <PageFromTheme />;
}
