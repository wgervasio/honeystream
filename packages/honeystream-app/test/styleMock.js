const styles = new Proxy(
  { __esModule: true },
  {
    get(target, property) {
      if (property in target) {
        return target[property]
      }

      return String(property)
    }
  }
)

styles.default = styles

module.exports = styles
