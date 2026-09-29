export class CodeSnippetGenerator {
  private supportedLanguages: Record<string, { name: string; formatter: (details: any) => string }>

  constructor() {
    this.supportedLanguages = {
      curl: { name: 'cURL', formatter: this.generateCurlSnippet.bind(this) },
      javascript: { name: 'JS/TS (Fetch)', formatter: this.generateJavaScriptSnippet.bind(this) },
      python: { name: 'Python (requests)', formatter: this.generatePythonSnippet.bind(this) },
      csharp: { name: 'C# (HttpClient)', formatter: this.generateCSharpSnippet.bind(this) },
      java: { name: 'Java (OkHttp)', formatter: this.generateJavaSnippet.bind(this) },
    }
  }

  getSupportedLanguages() {
    return Object.keys(this.supportedLanguages).map((key) => ({ id: key, name: this.supportedLanguages[key].name }))
  }

  generateSnippet(language: string, method: string, path: string, requestBody: string, headers: Record<string, string> = {}): string {
    if (!this.supportedLanguages[language]) return `// Language '${language}' is not supported yet.`
    if (requestBody && !headers['Content-Type']) headers['Content-Type'] = 'application/json'
    const requestDetails = {
      method,
      url: /^https?:\/\//i.test(path) ? path : `${window.location.origin}${path}`,
      headers,
      body: requestBody,
    }
    return this.supportedLanguages[language].formatter(requestDetails)
  }

  private generateCurlSnippet(details: any): string {
    const { method, url, headers, body } = details
    let curl = `curl -X ${method.toUpperCase()} "${url}"`
    if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        curl += value ? ` \\\n  -H "${key}: ${value}"` : ` \\\n  -H "${key}:"`
      }
    }
    if (body) {
      const escapedBody = String(body).replace(/'/g, "'\\''")
      curl += ` \\\n  -d '${escapedBody}'`
    }
    return curl
  }

  private generateJavaScriptSnippet(details: any): string {
    const { method, url, headers, body } = details
    const options: any = { method: method.toUpperCase(), headers }
    if (body) options.body = body
    return `fetch("${url}", ${JSON.stringify(options, null, 2)})
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));`
  }

  private generatePythonSnippet(details: any): string {
    const { method, url, headers, body } = details
    let snippet = `import requests\n\nurl = "${url}"`
    snippet += Object.keys(headers).length > 0 ? `\nheaders = ${JSON.stringify(headers, null, 2)}` : '\nheaders = {}'
    if (body) snippet += `\n\ndata = ${body}`
    snippet += `\n\nresponse = requests.${method.toLowerCase()}(url${body ? ', json=data' : ''}${Object.keys(headers).length > 0 ? ', headers=headers' : ''})\nprint(response.json())`
    return snippet
  }

  private generateCSharpSnippet(details: any): string {
    const { method, url, headers, body } = details
    let code = '// Create HttpClient instance\nusing var client = new HttpClient();\n\n'
    if (headers && Object.keys(headers).length > 0) {
      code += '// Set request headers\n'
      for (const [key, value] of Object.entries(headers)) {
        code += value ? `client.DefaultRequestHeaders.Add("${key}", "${value}");\n` : `client.DefaultRequestHeaders.Add("${key}", "");\n`
      }
      code += '\n'
    }
    code += 'try\n{\n'
    code += `    var requestUri = new Uri("${url}");\n`
    code += '    HttpResponseMessage response;\n\n'
    switch (method.toUpperCase()) {
      case 'GET': code += '    // Send GET request\n    response = await client.GetAsync(requestUri);\n'; break
      case 'DELETE': code += '    // Send DELETE request\n    response = await client.DeleteAsync(requestUri);\n'; break
      case 'POST': case 'PUT': case 'PATCH': {
        const methodName = method.charAt(0).toUpperCase() + method.slice(1).toLowerCase()
        code += '    // Create request content\n'
        if (body) { code += `    var json = @"${body.replace(/"/g, '""')}";\n    var content = new StringContent(json, Encoding.UTF8, "application/json");\n\n` }
        else { code += '    var content = new StringContent("", Encoding.UTF8, "application/json");\n\n' }
        if (method.toUpperCase() === 'PATCH') {
          code += `    var request = new HttpRequestMessage(new HttpMethod("PATCH"), requestUri) { Content = content };\n    response = await client.SendAsync(request);\n`
        } else {
          code += `    response = await client.${methodName}Async(requestUri, content);\n`
        }
        break
      }
      default: code += `    var request = new HttpRequestMessage(new HttpMethod("${method.toUpperCase()}"), requestUri);\n    response = await client.SendAsync(request);\n`
    }
    code += '\n    response.EnsureSuccessStatusCode();\n\n'
    code += '    var responseContent = await response.Content.ReadAsStringAsync();\n'
    code += '    Console.WriteLine(responseContent);\n}\ncatch (HttpRequestException e)\n{\n'
    code += '    Console.WriteLine($"Request error: {e.Message}");\n}\n'
    return code
  }

  private generateJavaSnippet(details: any): string {
    const { method, url, headers, body } = details
    let code = `OkHttpClient client = new OkHttpClient();\n\nMediaType mediaType = MediaType.parse("application/json");`
    if (body) code += `\nRequestBody body = RequestBody.create(mediaType, ${JSON.stringify(body)});`
    code += `\n\nRequest.Builder requestBuilder = new Request.Builder()\n  .url("${url}")`
    if (headers && Object.keys(headers).length > 0) {
      for (const [key, value] of Object.entries(headers)) {
        code += value ? `\n  .addHeader("${key}", "${value}")` : `\n  .addHeader("${key}", "")`
      }
    }
    code += `\n  .method("${method.toUpperCase()}", ${body ? 'body' : 'null'});\n    \nRequest request = requestBuilder.build();\nResponse response = client.newCall(request).execute();\nSystem.out.println(response.body().string());`
    return code
  }
}
