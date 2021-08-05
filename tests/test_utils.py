import unittest

from being.utils import SingleInstanceCache, IdAware, NestedDict


class Foo(SingleInstanceCache):

    """Test class."""

    pass


class TestSingleInstanceCache(unittest.TestCase):
    def setUp(self):
        Foo.single_instance_clear()

    def test_initializing_an_instance_does_not_add_it_to_the_cache(self):
        foo = Foo()

        self.assertNotIn(Foo, Foo.INSTANCES)

    def test_constructing_an_instance_via_default_puts_it_int_the_cache(self):
        foo = Foo.single_instance_setdefault()

        self.assertIn(Foo, Foo.INSTANCES)

    def test_same_reference_in_cache(self):
        a = Foo.single_instance_setdefault()
        b = Foo.single_instance_setdefault()

        self.assertIs(a, b)


class TestIdAware(unittest.TestCase):
    def test_instances_of_two_different_classes_have_ascending_ids(self):
        class Foo(IdAware):
            pass

        class Bar(IdAware):
            pass

        a = Foo()
        b = Bar()
        c = Foo()

        self.assertEqual(a.id, 0)
        self.assertEqual(b.id, 0)
        self.assertEqual(c.id, 1)


class TestNestedDict(unittest.TestCase):
    def test_setting_item_can_lead_to_keyerrors(self):
        d = NestedDict()

        with self.assertRaises(KeyError):
            d['this', 'is', 'it'] = 'Hello, world!'

        d['this'] = {}
        d['this', 'is'] = {}
        d['this', 'is', 'it'] = 'Hello, world!'

        self.assertEqual(d, {'this': {'is': {'it': 'Hello, world!'}}})

    def test_missing_item_results_in_keyerror(self):
        d = NestedDict()

        with self.assertRaises(KeyError):
            d['this', 'is', 'it']

    def test_get_works_as_expected(self):
        d = NestedDict()
        keys = ('this', 'is', 'it')

        self.assertEqual(d.get(keys), None)

    def test_setdefault_creates_intermediate_dicts(self):
        d = NestedDict()
        keys = ('this', 'is', 'it')

        value = d.setdefault(keys, 42)

        self.assertEqual(value, 42)
        self.assertEqual(d, {'this': {'is': {'it': 42}}})


if __name__ == '__main__':
    unittest.main()
