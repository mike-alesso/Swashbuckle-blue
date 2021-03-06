import { createSelector } from "reselect"
import { sorters } from "core/utils"
import { fromJS, Set, Map, OrderedMap, List } from "immutable"
import { updateResolved } from "./actions"

const DEFAULT_TAG = "default"
const OPERATION_METHODS = ["get", "put", "post", "delete", "options", "head", "patch"]

const state = state => {
  return state || Map()
}

export const lastError = createSelector(
  state,
  spec => spec.get("lastError")
)

export const url = createSelector(
  state,
  spec => spec.get("url")
)

export const specStr = createSelector(
  state,
  spec => spec.get("spec") || ""
)

export const specSource = createSelector(
  state,
  spec => spec.get("specSource") || "not-editor"
)

export const specJson = createSelector(
  state,
  spec => spec.get("json", Map())
)

export const specResolved = createSelector(
  state,
  spec => spec.get("resolved", Map())
)

// Default Spec ( as an object )
export const spec = state => {
  let res = specResolved(state)
  return res
}

export const info = createSelector(
  spec,
  spec => returnSelfOrNewMap(spec && spec.get("info"))
)

export const externalDocs = createSelector(
  spec,
  spec => returnSelfOrNewMap(spec && spec.get("externalDocs"))
)

export const version = createSelector(
  info,
  info => info && info.get("version")
)

export const semver = createSelector(
  version,
  version => /v?([0-9]*)\.([0-9]*)\.([0-9]*)/i.exec(version).slice(1)
)

export const paths = createSelector(
  spec,
  spec => spec.get("paths")
)

export const operations = createSelector(
  paths,
  paths => {
    if (!paths || paths.size < 1)
      return List()

    let list = List()

    if (!paths || !paths.forEach) {
      return List()
    }

    paths.forEach((path, pathName) => {
      if (!path || !path.forEach) {
        return {}
      }
      path.forEach((operation, method) => {
        if (OPERATION_METHODS.indexOf(method) === -1) {
          return
        }

        list = list.push(fromJS({
          path: pathName,
          method,
          operation,
          //customHeaders:fromJS( [{name:'test', value:'xxx'}]),
          // customHeaders: [{name:'test', value:'xxx'}],
          id: `${method}-${pathName}`
        }))
      })
    })

    return list
  }
)

export const consumes = createSelector(
  spec,
  spec => Set(spec.get("consumes"))
)

export const produces = createSelector(
  spec,
  spec => Set(spec.get("produces"))
)

// export const customHeaders = createSelector(
//   spec,
//   spec => Set(spec.get("customHeaders"))
// )

export const security = createSelector(
  spec,
  spec => spec.get("security", List())
)

export const securityDefinitions = createSelector(
  spec,
  spec => spec.get("securityDefinitions")
)

export const findDefinition = (state, name) => {
  return specResolved(state).getIn(["definitions", name], null)
}

export const definitions = createSelector(
  spec,
  spec => spec.get("definitions") || Map()
)

export const basePath = createSelector(
  spec,
  spec => spec.get("basePath")
)

export const host = createSelector(
  spec,
  spec => spec.get("host")
)

export const schemes = createSelector(
  spec,
  spec => spec.get("schemes", Map())
)

export const operationsWithRootInherited = createSelector(
  operations,
  consumes,
  produces,
  (operations, consumes, produces) => {
    return operations.map(ops => ops.update("operation", op => {
      if (op) {
        if (!Map.isMap(op)) { return }
        return op.withMutations(op => {
          if (!op.get("consumes")) {
            op.update("consumes", a => Set(a).merge(consumes))
          }
          if (!op.get("produces")) {
            op.update("produces", a => Set(a).merge(produces))
          }

          return op
        })
      } else {
        // return something with Immutable methods
        return Map()
      }
    }))
  }
)

export const tags = createSelector(
  spec,
  json => json.get("tags", List())
)

export const tagDetails = (state, tag) => {
  let currentTags = tags(state) || List()
  return currentTags.filter(Map.isMap).find(t => t.get("name") === tag, Map())
}

export const operationsWithTags = createSelector(
  operationsWithRootInherited,
  tags,
  version,
  (operations, tags, version) => {
    return operations.reduce((taggedMap, op) => {
      let tags = Set(op.getIn(["operation", "tags"]))
      var parentId = tags.first()
      var operationId = op.getIn(["operation", "operationId"])
      var routeId = parentId + '_' + operationId + '_' + op.get('method')

      if (!version && version !== 0) {
        version = 1;
      }

      op = op.set('parentId', parentId)
      op = op.set('routeId', routeId)
      op = op.set('urlHash', '/' + version + '/' + routeId)

      if (tags.count() < 1)
        return taggedMap.update(DEFAULT_TAG, List(), ar => ar.push(op))
      return tags.reduce((res, tag) => res.update(tag, List(), (ar) => ar.push(op)), taggedMap)
    }, tags.reduce((taggedMap, tag) => {
      return taggedMap.set(tag.get("name"), List())
    }, OrderedMap()))
  }
)

//used by sidebar and maybe operations.jsx
export const operationsExtraSlim = createSelector(
  operationsWithTags,
  (operationsWithTags) => {
    return operationsWithTags.map(ops => {
      return ops.map(op => {
        if (op) {
          op = op.set('operationId', op.get('operation').get('__originalOperationId'))
          return op.delete('operation')
        } else {
          // return something with Immutable methods
          return Map()
        }
      })
    })
  }
)

export const taggedOperations = (state) => ({ getConfigs }) => {
  let { tagsSorter, operationsSorter } = getConfigs()
  return operationsWithTags(state)
    .sortBy(
      (val, key) => key, // get the name of the tag to be passed to the sorter
      (tagA, tagB) => {
        let sortFn = (typeof tagsSorter === "function" ? tagsSorter : sorters.tagsSorter[tagsSorter])
        return (!sortFn ? null : sortFn(tagA, tagB))
      }
    )
    .map((ops, tag) => {
      let sortFn = (typeof operationsSorter === "function" ? operationsSorter : sorters.operationsSorter[operationsSorter])
      let operations = (!sortFn ? ops : ops.sort(sortFn))

      return Map({ tagDetails: tagDetails(state, tag), operations: operations })
    })
}

export function getOperation(state, parentId, pathMethod) {
  //taggedOperations
  //console.log('testfromSpec=', spec(state).getIn(["paths", ...pathMethod]).toJS() )
  //console.log('test=', spec(state).getIn(["paths"]).toJS())
  //console.log('operationsWithRootInherited=', operationsWithRootInherited(state).toJS())
  //console.log('operationsWithTags=', operationsWithTags(state).toJS()) //This is an OrderedMap

  //var ops1=operationsWithRootInherited(state)
  //return spec(state).getIn(["paths", ...pathMethod])
  var found = operationsWithTags(state).getIn([parentId]).find((x, y) => {
    //console.log(x, y)
    return x.get('path') == pathMethod[0] && x.get('method') == pathMethod[1]
  })

  if(found){
    return found.get('operation')
  }

  throw('Could not get operation: ', pathMethod);

}

export const getVersion = createSelector(
  version,
  (version) => {
    return version || '1'
  }
)

export const getUrlFromVersion = createSelector(
  version,
  (version) => {
    var selectedDocs = window.swashbuckleConfig.discoveryUrlObj.find(x => x.version === version)
    if (!selectedDocs) return null
    return window.swashbuckleConfig.rootUrl + '/' + selectedDocs.url
  }
)

export const responses = createSelector(
  state,
  state => state.get("responses", Map())
)

export const requests = createSelector(
  state,
  state => state.get("requests", Map())
)

export const responseFor = (state, path, method) => {
  return responses(state).getIn([path, method], null)
}

export const requestFor = (state, path, method) => {
  return requests(state).getIn([path, method], null)
}

export const allowTryItOutFor = () => {
  // This is just a hook for now.
  return true
}

// Get the parameter value by parameter name
export function getParameter(state, pathMethod, name) {
  // console.log('inside of getParameter', state, pathMethod, name)
  let params = spec(state).getIn(["paths", ...pathMethod, "parameters"], fromJS([]))
  return params.filter((p) => {
    return Map.isMap(p) && p.get("name") === name
  }).first()
}

export function getCustomHeader(state, pathMethod) {
  //let custHeaders = spec(state).getIn(["paths", ...pathMethod,  "customHeaders"], fromJS([{name:'asdasd', value:'123123'}]))
  let custHeaders = spec(state).getIn(["paths", ...pathMethod, "customHeaders"], fromJS([]))
  return custHeaders.toJS()
}

// export function setCustomHeader(state, pathMethod, custHeaderArry) {
//   //console.log('inside of setCustomHeader', state.toJS())
//   console.log('setting a new headexxxxr=',custHeaderArry)
//   let newSpec = spec(state).setIn(["paths", ...pathMethod, "customHeaders"], custHeaderArry)
//   updateResolved(newSpec.toJS())
//   console.log('getCustHeadersAfter=',getCustomHeader(state,pathMethod))
//   return newSpec
// }

export const hasHost = createSelector(
  spec,
  spec => {
    const host = spec.get("host")
    return typeof host === "string" && host.length > 0 && host[0] !== "/"
  }
)

// Get the parameter values, that the user filled out
export function parameterValues(state, pathMethod, isXml) {

  let params = spec(state).getIn(["paths", ...pathMethod, "parameters"], fromJS([]))
  return params.reduce((hash, p) => {
    let value = isXml && p.get("in") === "body" ? p.get("value_xml") : p.get("value")
    return hash.set(p.get("name"), value)
  }, fromJS({}))
}

// True if any parameter includes `in: ?`
export function parametersIncludeIn(parameters, inValue = "") {
  if (List.isList(parameters)) {
    return parameters.some(p => Map.isMap(p) && p.get("in") === inValue)
  }
}

// True if any parameter includes `type: ?`
export function parametersIncludeType(parameters, typeValue = "") {
  if (List.isList(parameters)) {
    return parameters.some(p => Map.isMap(p) && p.get("type") === typeValue)
  }
}

// Get the consumes/produces value that the user selected
export function contentTypeValues(state, pathMethod) {
  let op = spec(state).getIn(["paths", ...pathMethod], fromJS({}))
  const parameters = op.get("parameters") || new List()

  const requestContentType = (
    op.get("consumes_value") ? op.get("consumes_value") :
    parametersIncludeType(parameters, "file") ? "multipart/form-data" :
    parametersIncludeType(parameters, "formData") ? "application/x-www-form-urlencoded" :
    undefined
  )

  return fromJS({
    requestContentType,
    responseContentType: op.get("produces_value")
  })
}

// Get the consumes/produces by path
export function operationConsumes(state, pathMethod) {
  return spec(state).getIn(["paths", ...pathMethod, "consumes"], fromJS({}))
}

export const operationScheme = (state, path, method) => {
  let url = state.get("url")
  let matchResult = url.match(/^([a-z][a-z0-9+\-.]*):/)
  let urlScheme = Array.isArray(matchResult) ? matchResult[1] : null

  return state.getIn(["scheme", path, method]) || state.getIn(["scheme", "_defaultScheme"]) || urlScheme || ""
}

export const canExecuteScheme = (state, path, method) => {
  return ["http", "https"].indexOf(operationScheme(state, path, method)) > -1
}

export const validateBeforeExecute = (state, pathMethod) => {
  let params = spec(state).getIn(["paths", ...pathMethod, "parameters"], fromJS([]))
  let isValid = true

  params.forEach((p) => {
    let errors = p.get("errors")
    if (errors && errors.count()) {
      isValid = false
    }
  })

  return isValid
}

function returnSelfOrNewMap(obj) {
  // returns obj if obj is an Immutable map, else returns a new Map
  return Map.isMap(obj) ? obj : new Map()
}
