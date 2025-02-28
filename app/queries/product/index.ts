/**
 * Retrieves product details by product handle.
 */
export async function getProductDetails(
  productHandle: string
): Promise<any | null> {
  const url = `${process.env.SHOP_URL}/admin/api/${process.env.API_VERSION}/graphql.json`;

  // GraphQL query to fetch a product by its exact handle.
  const query = `
      query GetProductByHandle($handle: String!) {
        productByHandle(handle: $handle) {
          id
          title
          handle
          descriptionHtml
        }
      }
    `;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN,
      },
      body: JSON.stringify({
        query,
        variables: { handle: productHandle.toUpperCase() },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log(result);
    return result.data?.productByHandle || null;
  } catch (error) {
    console.error("Error fetching product details:", error);
    return null;
  }
}
