// FLAGS: -Wdeprecated-declarations
__attribute__((deprecated("use new_api instead")))
int old_api(void);

int call(void) {
    return old_api();
}
