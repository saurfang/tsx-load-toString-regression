// A no-op async load hook. Registered via module.register() below.
// This is the minimum needed to trigger the regression: ANY async load hook
// (including pass-through ones) installed alongside tsx is enough.
export async function load(url, context, nextLoad) {
  return nextLoad(url, context);
}
