// C# API Client Generator for openapi-ui
// Adapted from the original React version

function resolveRef(value, spec, visited = new Set()) {
  if (!value?.$ref) return value || {}
  if (!value.$ref.startsWith('#/')) throw new Error(`External reference is not supported: ${value.$ref}`)
  if (visited.has(value.$ref)) return {}
  visited.add(value.$ref)
  const target = value.$ref
    .slice(2)
    .split('/')
    .reduce((current, key) => current?.[decodeURIComponent(key).replace(/~1/g, '/').replace(/~0/g, '~')], spec)
  if (!target) throw new Error(`Reference not found: ${value.$ref}`)
  return { ...resolveRef(target, spec, visited), ...Object.fromEntries(Object.entries(value).filter(([key]) => key !== '$ref')) }
}

export class CSharpApiGenerator {
  constructor(options = {}) {
    this.swagger = null
    this.options = {
      usePascalCase: true,
      useFields: false,
      useNullableTypes: false,
      addJsonPropertyAttributes: false,
      useJsonPropertyName: false,
      generateImmutableClasses: false,
      useRecordTypes: false,
      useReadonlyLists: false,
      useFileScopedNamespaces: false,
      usePrimaryConstructors: false,
      ...options,
    }
  }

  loadFromSwaggerData(swaggerData) {
    if (!swaggerData) throw new Error('No swagger data provided')
    this.swagger = swaggerData
    return this.swagger
  }

  generateClient(namespace = 'ApiClient', className = 'ApiClient') {
    if (!this.swagger) throw new Error('No loaded specification')
    const models = this.generateModels(namespace)
    const interfaces = this.generateInterfaces(namespace)
    const client = this.generateClientClass(namespace, className)
    return { client, models, interfaces }
  }

  generateModels(namespace) {
    let code = `using System;\nusing System.Collections.Generic;\nusing System.ComponentModel.DataAnnotations;\n`
    if (this.options.useJsonPropertyName) code += `using System.Text.Json.Serialization;\n`
    else if (this.options.addJsonPropertyAttributes) code += `using Newtonsoft.Json;\n`
    if (this.options.useFileScopedNamespaces) code += `\nnamespace ${namespace}.Models;\n\n`
    else code += `\nnamespace ${namespace}.Models\n{\n`
    if (this.swagger.components && this.swagger.components.schemas) {
      for (const [name, schema] of Object.entries(this.swagger.components.schemas)) {
        code += this.generateModelClass(name, schema)
      }
    }
    if (!this.options.useFileScopedNamespaces) code += `}\n`
    return code
  }

  generateModelClass(name, schema) {
    if (this.options.useRecordTypes && !this.options.generateImmutableClasses) return this.generateRecordClass(name, schema)
    const className = this.options.usePascalCase ? this.toPascalCase(name) : name
    if (this.options.usePrimaryConstructors && schema.properties) return this.generatePrimaryConstructorClass(name, schema)
    const indent = this.options.useFileScopedNamespaces ? '' : '    '
    let code = `${indent}public class ${className}\n${indent}{\n`
    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const csharpType = this.mapToCSharpType(propSchema)
        const isRequired = schema.required && schema.required.includes(propName)
        const finalType = this.options.useNullableTypes && !isRequired && !csharpType.includes('?') && !csharpType.startsWith('List<') ? `${csharpType}?` : csharpType
        const memberName = this.options.usePascalCase ? this.toPascalCase(propName) : propName
        if (this.options.addJsonPropertyAttributes) code += `${indent}    [JsonProperty("${propName}")]\n`
        else if (this.options.useJsonPropertyName) code += `${indent}    [JsonPropertyName("${propName}")]\n`
        if (isRequired) code += `${indent}    [Required]\n`
        if (this.options.useFields) code += `${indent}    public ${finalType} ${memberName};\n\n`
        else if (this.options.generateImmutableClasses) code += `${indent}    public ${finalType} ${memberName} { get; init; }\n\n`
        else code += `${indent}    public ${finalType} ${memberName} { get; set; }\n\n`
      }
    }
    code += `${indent}}\n\n`
    return code
  }

  generateRecordClass(name, schema) {
    const className = this.options.usePascalCase ? this.toPascalCase(name) : name
    const parameters = []
    const indent = this.options.useFileScopedNamespaces ? '' : '    '
    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const csharpType = this.mapToCSharpType(propSchema)
        const isRequired = schema.required && schema.required.includes(propName)
        const finalType = this.options.useNullableTypes && !isRequired && !csharpType.includes('?') && !csharpType.startsWith('List<') ? `${csharpType}?` : csharpType
        const memberName = this.options.usePascalCase ? this.toPascalCase(propName) : propName
        let paramStr = `${finalType} ${memberName}`
        if (!isRequired && this.options.useNullableTypes) paramStr += ' = null'
        parameters.push(paramStr)
      }
    }
    let code = `${indent}public record ${className}(\n`
    code += parameters.map((p) => `${indent}    ${p}`).join(',\n')
    code += `\n${indent});\n\n`
    return code
  }

  generatePrimaryConstructorClass(name, schema) {
    const className = this.options.usePascalCase ? this.toPascalCase(name) : name
    const indent = this.options.useFileScopedNamespaces ? '' : '    '
    const constructorParams = []
    let propertyCode = ''
    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const csharpType = this.mapToCSharpType(propSchema)
        const isRequired = schema.required && schema.required.includes(propName)
        const finalType = this.options.useNullableTypes && !isRequired && !csharpType.includes('?') && !csharpType.startsWith('List<') ? `${csharpType}?` : csharpType
        const memberName = this.options.usePascalCase ? this.toPascalCase(propName) : propName
        let paramStr = `${finalType} ${memberName.charAt(0).toLowerCase() + memberName.slice(1)}`
        if (!isRequired && this.options.useNullableTypes) paramStr += ' = null'
        constructorParams.push(paramStr)
        if (this.options.addJsonPropertyAttributes) propertyCode += `${indent}    [JsonProperty("${propName}")]\n`
        else if (this.options.useJsonPropertyName) propertyCode += `${indent}    [JsonPropertyName("${propName}")]\n`
        if (isRequired) propertyCode += `${indent}    [Required]\n`
        const lowerName = memberName.charAt(0).toLowerCase() + memberName.slice(1)
        if (this.options.useFields) propertyCode += `${indent}    public ${finalType} ${memberName} = ${lowerName};\n\n`
        else if (this.options.generateImmutableClasses) propertyCode += `${indent}    public ${finalType} ${memberName} { get; init; } = ${lowerName};\n\n`
        else propertyCode += `${indent}    public ${finalType} ${memberName} { get; set; } = ${lowerName};\n\n`
      }
    }
    let code = `${indent}public class ${className}(\n`
    code += constructorParams.map((p) => `${indent}    ${p}`).join(',\n')
    code += `\n${indent})\n${indent}{\n`
    code += propertyCode
    code += `${indent}}\n\n`
    return code
  }

  generateInterfaces(namespace) {
    let code = `using System;\nusing System.Collections.Generic;\nusing System.Threading.Tasks;\nusing ${namespace}.Models;\n\n`
    if (this.options.useFileScopedNamespaces) {
      code += `namespace ${namespace}.Interfaces;\n\npublic interface IApiClient\n{\n`
    } else {
      code += `namespace ${namespace}.Interfaces\n{\n    public interface IApiClient\n    {\n`
    }
    if (this.swagger.paths) {
      const indent = this.options.useFileScopedNamespaces ? '    ' : '        '
      for (const [path, methods] of Object.entries(this.swagger.paths)) {
        for (const [method, operation] of Object.entries(methods)) {
          if (typeof operation === 'object' && method !== 'parameters') {
            code += `${indent}${this.generateMethodSignature(operation, method, path)};\n`
          }
        }
      }
    }
    if (this.options.useFileScopedNamespaces) code += `}\n`
    else code += `    }\n}\n`
    return code
  }

  generateClientClass(namespace, className) {
    let code = `using System;\nusing System.Collections.Generic;\nusing System.Net.Http;\nusing System.Text;\nusing System.Threading.Tasks;\nusing Newtonsoft.Json;\nusing ${namespace}.Models;\nusing ${namespace}.Interfaces;\n\n`
    if (this.options.useFileScopedNamespaces) code += `namespace ${namespace};\n\n`
    else code += `namespace ${namespace}\n{\n`
    const indent = this.options.useFileScopedNamespaces ? '    ' : '        '
    const classIndent = this.options.useFileScopedNamespaces ? '' : '    '
    if (this.options.usePrimaryConstructors) {
      code += `public class ${className}(\n    HttpClient httpClient,\n    string baseUrl\n) : IApiClient\n{\n`
      code += `${indent}private readonly HttpClient _httpClient = httpClient ?? throw new ArgumentNullException(nameof(httpClient));\n`
      code += `${indent}private readonly string _baseUrl = baseUrl?.TrimEnd('/') ?? throw new ArgumentNullException(nameof(baseUrl));\n\n`
    } else {
      code += `${classIndent}public class ${className} : IApiClient\n${classIndent}{\n`
      code += `${indent}private readonly HttpClient _httpClient;\n${indent}private readonly string _baseUrl;\n\n`
      code += `${indent}public ${className}(HttpClient httpClient, string baseUrl)\n${indent}{\n`
      code += `${indent}    _httpClient = httpClient ?? throw new ArgumentNullException(nameof(httpClient));\n`
      code += `${indent}    _baseUrl = baseUrl?.TrimEnd('/') ?? throw new ArgumentNullException(nameof(baseUrl));\n${indent}}\n\n`
    }
    if (this.swagger.paths) {
      for (const [path, methods] of Object.entries(this.swagger.paths)) {
        for (const [method, operation] of Object.entries(methods)) {
          if (typeof operation === 'object' && method !== 'parameters') code += this.generateMethod(path, method, operation)
        }
      }
    }
    code += `${indent}private async Task<T> SendRequestAsync<T>(string url, HttpMethod method, object content = null)\n${indent}{\n`
    code += `${indent}    var request = new HttpRequestMessage(method, url);\n\n`
    code += `${indent}    if (content != null)\n${indent}    {\n`
    code += `${indent}        var json = JsonConvert.SerializeObject(content);\n`
    code += `${indent}        request.Content = new StringContent(json, Encoding.UTF8, "application/json");\n${indent}    }\n\n`
    code += `${indent}    var response = await _httpClient.SendAsync(request);\n`
    code += `${indent}    response.EnsureSuccessStatusCode();\n\n`
    code += `${indent}    var responseContent = await response.Content.ReadAsStringAsync();\n`
    code += `${indent}    return JsonConvert.DeserializeObject<T>(responseContent);\n${indent}}\n\n`
    code += `${indent}private async Task SendRequestAsync(string url, HttpMethod method, object content = null)\n${indent}{\n`
    code += `${indent}    var request = new HttpRequestMessage(method, url);\n\n`
    code += `${indent}    if (content != null)\n${indent}    {\n`
    code += `${indent}        var json = JsonConvert.SerializeObject(content);\n`
    code += `${indent}        request.Content = new StringContent(json, Encoding.UTF8, "application/json");\n${indent}    }\n\n`
    code += `${indent}    var response = await _httpClient.SendAsync(request);\n`
    code += `${indent}    response.EnsureSuccessStatusCode();\n${indent}}\n`
    if (this.options.useFileScopedNamespaces) code += `}\n`
    else code += `    }\n}\n`
    return code
  }

  generateMethod(path, httpMethod, operation) {
    const methodName = operation.operationId || this.generateMethodName(path, httpMethod)
    const returnType = this.getReturnType(operation)
    const parameters = this.getMethodParameters(operation)
    const pathWithParams = this.buildPathWithParameters(path, operation)
    const indent = this.options.useFileScopedNamespaces ? '    ' : '        '
    const bodyIndent = this.options.useFileScopedNamespaces ? '        ' : '            '
    let code = `${indent}public async Task${returnType} ${methodName}(${parameters})\n${indent}{\n`
    code += `${bodyIndent}var url = $"{{_baseUrl}}${pathWithParams}";\n`
    if (httpMethod.toLowerCase() === 'get' || httpMethod.toLowerCase() === 'delete') {
      if (returnType === '') code += `${bodyIndent}await SendRequestAsync(url, HttpMethod.${this.capitalizeFirst(httpMethod)});\n`
      else code += `${bodyIndent}return await SendRequestAsync${returnType}(url, HttpMethod.${this.capitalizeFirst(httpMethod)});\n`
    } else {
      const requestBody = this.getRequestBodyParam(operation)
      if (returnType === '') code += `${bodyIndent}await SendRequestAsync(url, HttpMethod.${this.capitalizeFirst(httpMethod)}${requestBody ? `, ${requestBody}` : ''});\n`
      else code += `${bodyIndent}return await SendRequestAsync${returnType}(url, HttpMethod.${this.capitalizeFirst(httpMethod)}${requestBody ? `, ${requestBody}` : ''});\n`
    }
    code += `${indent}}\n\n`
    return code
  }

  generateMethodSignature(operation, httpMethod, path = '') {
    const methodName = operation.operationId || this.generateMethodName(path, httpMethod)
    const returnType = this.getReturnType(operation)
    const parameters = this.getMethodParameters(operation)
    return `Task${returnType} ${methodName}(${parameters})`
  }

  getReturnType(operation) {
    if (!operation.responses || !operation.responses['200']) return ''
    const response = operation.responses['200']
    if (response.content && response.content['application/json']) {
      const schema = response.content['application/json'].schema
      if (schema) return `<${this.mapToCSharpType(schema)}>`
    }
    return ''
  }

  getMethodParameters(operation) {
    const params = []
    if (operation.parameters) {
      for (const param of operation.parameters) {
        const csharpType = this.mapToCSharpType(param.schema || { type: 'string' })
        params.push(`${csharpType} ${param.name}`)
      }
    }
    if (operation.requestBody) {
      const resolvedRequestBody = resolveRef(operation.requestBody, this.swagger)
      const content = resolvedRequestBody ? resolvedRequestBody.content : null
      if (content && content['application/json']) {
        const schema = content['application/json'].schema
        const type = this.mapToCSharpType(schema)
        params.push(`${type} requestBody`)
      }
    }
    return params.join(', ')
  }

  getRequestBodyParam(operation) {
    return operation.requestBody ? 'requestBody' : null
  }

  buildPathWithParameters(path, operation) {
    let result = path
    if (operation.parameters) {
      for (const param of operation.parameters) {
        if (param.in === 'path') result = result.replace(`{${param.name}}`, `{${param.name}}`)
      }
      const queryParams = operation.parameters.filter((p) => p.in === 'query')
      if (queryParams.length > 0) {
        const queryString = queryParams.map((p) => `${p.name}={${p.name}}`).join('&')
        result += `?${queryString}`
      }
    }
    return result
  }

  mapToCSharpType(schema) {
    if (!schema) return 'object'
    if (schema.$ref) {
      const refName = schema.$ref.split('/').pop()
      return this.options.usePascalCase ? this.toPascalCase(refName) : refName
    }
    if (schema.type === 'array') {
      const itemType = this.mapToCSharpType(schema.items)
      return this.options.useReadonlyLists ? `IReadOnlyList<${itemType}>` : `List<${itemType}>`
    }
    switch (schema.type) {
      case 'integer': return schema.format === 'int64' ? 'long' : 'int'
      case 'number': return schema.format === 'float' ? 'float' : 'double'
      case 'string': return schema.format === 'date-time' || schema.format === 'date' ? 'DateTime' : 'string'
      case 'boolean': return 'bool'
      case 'object': return 'object'
      default: return 'object'
    }
  }

  generateMethodName(path, method) {
    let cleanPath = path.replace(/[{}]/g, '').replace(/[\/\-]/g, '_').replace(/^_+|_+$/g, '').replace(/_+/g, '_')
    if (!cleanPath || cleanPath === '_') cleanPath = 'Resource'
    const methodPart = this.capitalizeFirst(method)
    const pathPart = cleanPath.split('_').map((part) => this.capitalizeFirst(part)).join('')
    return `${methodPart}${pathPart}`
  }

  toPascalCase(str) { return str.charAt(0).toUpperCase() + str.slice(1) }
  capitalizeFirst(str) { return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() }
  updateOptions(newOptions) { this.options = { ...this.options, ...newOptions } }
}
