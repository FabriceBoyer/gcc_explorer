// FLAGS: -fanalyzer
#include <stdlib.h>
int use_after_free(void) {
    int *p = (int *) malloc(sizeof(int));
    free(p);
    return *p;
}
